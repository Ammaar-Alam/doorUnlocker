import CoreBluetooth
import Observation
#if os(iOS)
import AccessorySetupKit
import UIKit
#endif

enum BluetoothRecovery: Equatable {
    case stopped, waiting, retry, pairAgain

    static func action(error: Error?, enabled: Bool, isReconnecting: Bool) -> Self {
        guard enabled else { return .stopped }
        if let error = error as NSError?, error.domain == CBErrorDomain,
           error.code == CBError.peerRemovedPairingInformation.rawValue { return .pairAgain }
        return isReconnecting ? .waiting : .retry
    }
}

@Observable
final class BluetoothConnection: NSObject, CBCentralManagerDelegate, CBPeripheralDelegate {
    var enabled = UserDefaults.standard.bool(forKey: "autoConnect")
    var status = "Not connected"
    var pairingRequired = UserDefaults.standard.bool(forKey: "pairingRequired")
    var entries: [String] = []
    private var central: CBCentralManager!
    private var door: CBPeripheral?
    private var retry: DispatchWorkItem?
    private let service = CBUUID(string: "180A")
#if os(iOS)
    private let accessorySession = ASAccessorySession()
    var setupReady = false
    var setupBusy = false
    var managedID: UUID?
#endif

    override init() {
        super.init()
        if pairingRequired { status = "Forget this door, then connect again" }
#if os(iOS)
        accessorySession.activate(on: .main) { [weak self] event in
            self?.accessoryEvent(event)
        }
#else
        startCentral()
#endif
    }

    private func startCentral() {
        guard central == nil else { resume(); return }
        central = CBCentralManager(delegate: self, queue: .main, options: [
            CBCentralManagerOptionRestoreIdentifierKey: "DoorOpener.connection",
            CBCentralManagerOptionShowPowerAlertKey: false
        ])
    }

#if os(iOS)
    private func accessoryEvent(_ event: ASAccessoryEvent) {
        if let error = event.error { status = error.localizedDescription; log(status) }
        switch event.eventType {
        case .activated, .accessoryAdded, .accessoryChanged, .migrationComplete:
            setupReady = true
            let saved = UserDefaults.standard.string(forKey: "doorID")
            let accessory = event.accessory ?? accessorySession.accessories.first(where: { $0.bluetoothIdentifier?.uuidString == saved }) ?? accessorySession.accessories.first
            if let id = accessory?.bluetoothIdentifier {
                if managedID != id {
                    door?.delegate = nil
                    if let door { central?.cancelPeripheralConnection(door) }
                    door = nil
                }
                managedID = id
                UserDefaults.standard.set(id.uuidString, forKey: "doorID")
                if event.eventType == .accessoryAdded || event.eventType == .migrationComplete {
                    enabled = true
                    UserDefaults.standard.set(true, forKey: "autoConnect")
                }
                startCentral()
            } else { status = "Connect your door to finish setup" }
        case .accessoryRemoved:
            if event.accessory?.bluetoothIdentifier == managedID {
                clearSelection()
                managedID = nil
                pairingRequired = false
                UserDefaults.standard.removeObject(forKey: "pairingRequired")
                central?.delegate = nil
                central = nil
                status = "Door forgotten"
            }
        case .invalidated:
            setupReady = false
        default: break
        }
    }

    func connectDoor() {
        guard setupReady, !setupBusy else { return }
        if managedID != nil {
            setEnabled(false)
            setEnabled(true)
            return
        }
        let descriptor = ASDiscoveryDescriptor()
        descriptor.bluetoothServiceUUID = service
        descriptor.bluetoothNameSubstring = "Ammaar's Door Opener"
        descriptor.supportedOptions = [.bluetoothPairingLE]
        let image = UIImage(systemName: "door.left.hand.closed")!
        let item: ASPickerDisplayItem
        if let saved = UserDefaults.standard.string(forKey: "doorID"), let id = UUID(uuidString: saved) {
            let migration = ASMigrationDisplayItem(name: "Door Opener", productImage: image, descriptor: descriptor)
            migration.peripheralIdentifier = id
            item = migration
        } else {
            item = ASPickerDisplayItem(name: "Door Opener", productImage: image, descriptor: descriptor)
        }
        setupBusy = true
        accessorySession.showPicker(for: [item]) { [weak self] error in
            DispatchQueue.main.async {
                self?.setupBusy = false
                if let error { self?.status = error.localizedDescription; self?.log(error.localizedDescription) }
            }
        }
    }

    func forgetDoor() {
        guard !setupBusy, let accessory = accessorySession.accessories.first(where: { $0.bluetoothIdentifier == managedID }) else { return }
        setEnabled(false)
        setupBusy = true
        accessorySession.removeAccessory(accessory) { [weak self] error in
            DispatchQueue.main.async {
                self?.setupBusy = false
                if let error { self?.status = error.localizedDescription; self?.log(error.localizedDescription) }
            }
        }
    }
#endif

    func log(_ message: String) {
        entries.insert("\(Date().formatted(date: .omitted, time: .standard))  \(message)", at: 0)
        if entries.count > 200 { entries.removeLast(entries.count - 200) }
    }

    func setEnabled(_ value: Bool) {
        enabled = value
        UserDefaults.standard.set(value, forKey: "autoConnect")
        retry?.cancel()
        if value { resume() }
        else {
            central?.stopScan()
            if let door { central?.cancelPeripheralConnection(door) }
            status = "Auto-connect off"
            log(status)
        }
    }

    private func clearSelection() {
        setEnabled(false)
        door?.delegate = nil
        door = nil
        UserDefaults.standard.removeObject(forKey: "doorID")
        status = "No door selected"
        log("Saved door forgotten")
    }

    func select(_ peripheral: CBPeripheral) {
        central?.stopScan()
        if let door, door.identifier != peripheral.identifier { central.cancelPeripheralConnection(door) }
        door = peripheral
        UserDefaults.standard.set(peripheral.identifier.uuidString, forKey: "doorID")
        setEnabled(true)
    }

    func resume() {
        guard enabled, let central, central.state == .poweredOn else { return }
        if door == nil, let saved = UserDefaults.standard.string(forKey: "doorID"), let id = UUID(uuidString: saved) {
            door = central.retrievePeripherals(withIdentifiers: [id]).first
        }
        if let door {
            door.delegate = self
            switch door.state {
            case .connected: prepare(door)
            case .disconnected:
                status = "Waiting for your door"
                central.connect(door, options: [CBConnectPeripheralOptionEnableAutoReconnect: true])
            default: status = "Waiting for your door"
            }
        } else {
            status = "Looking for your door"
            central.scanForPeripherals(withServices: [service])
        }
    }

    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        if central.state == .poweredOn {
            if enabled { resume() } else { central.stopScan() }
        }
        else {
            status = central.state == .unauthorized ? "Allow Bluetooth in Settings" : "Bluetooth unavailable"
            log(status)
        }
    }

    func centralManager(_ central: CBCentralManager, willRestoreState dict: [String: Any]) {
        let restored = dict[CBCentralManagerRestoredStatePeripheralsKey] as? [CBPeripheral] ?? []
        for peripheral in restored {
            if enabled, peripheral.identifier.uuidString == UserDefaults.standard.string(forKey: "doorID") {
                door = peripheral
                peripheral.delegate = self
            } else { central.cancelPeripheralConnection(peripheral) }
        }
        log("Bluetooth session restored")
    }

    func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String: Any], rssi RSSI: NSNumber) {
        let name = advertisementData[CBAdvertisementDataLocalNameKey] as? String ?? peripheral.name
        guard name == "Ammaar's Door Opener" else { return }
        if peripheral.identifier.uuidString == UserDefaults.standard.string(forKey: "doorID") { select(peripheral) }
    }

    func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        guard enabled, peripheral.identifier == door?.identifier else { central.cancelPeripheralConnection(peripheral); return }
        log("Connected to door")
        prepare(peripheral)
    }

    private func prepare(_ peripheral: CBPeripheral) {
        status = "Connected · checking pairing"
        peripheral.delegate = self
        peripheral.discoverServices([service])
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        guard enabled, peripheral.identifier == door?.identifier else { return }
        if let error { recover(peripheral, error: error); return }
        guard let service = peripheral.services?.first(where: { $0.uuid == self.service }) else {
            status = "Could not read door service"; log(status); return
        }
        peripheral.discoverCharacteristics([CBUUID(string: "2A24")], for: service)
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        guard enabled, peripheral.identifier == door?.identifier else { return }
        if let error { recover(peripheral, error: error); return }
        guard let model = service.characteristics?.first(where: { $0.uuid == CBUUID(string: "2A24") }) else {
            status = "Could not read door identity"; log(status); return
        }
        peripheral.readValue(for: model)
    }

    func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        guard enabled, peripheral.identifier == door?.identifier else { return }
        if let error {
            recover(peripheral, error: error)
            return
        }
        guard characteristic.value == Data("Door Opener".utf8) else {
            setEnabled(false)
            status = "Door identity check failed"
            log(status)
            return
        }
        pairingRequired = false
        UserDefaults.standard.removeObject(forKey: "pairingRequired")
        status = "Connected"
        log("Door identity verified")
    }

    func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, timestamp: CFAbsoluteTime, isReconnecting: Bool, error: Error?) {
        guard peripheral.identifier == door?.identifier else { return }
        log("Disconnected\(isReconnecting ? " · iOS is reconnecting" : "")")
        recover(peripheral, error: error, isReconnecting: isReconnecting)
    }

    func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
        guard peripheral.identifier == door?.identifier else { return }
        recover(peripheral, error: error)
    }

    private func recover(_ peripheral: CBPeripheral, error: Error?, isReconnecting: Bool = false) {
        if let error { log(error.localizedDescription) }
        switch BluetoothRecovery.action(error: error, enabled: enabled, isReconnecting: isReconnecting) {
        case .pairAgain:
            setEnabled(false)
            pairingRequired = true
            UserDefaults.standard.set(true, forKey: "pairingRequired")
            status = "Forget this door, then connect again"
            log(status)
        case .retry:
            status = "Waiting for your door"
            if peripheral.state == .connected { central.cancelPeripheralConnection(peripheral) }
            else { scheduleRetry() }
        case .waiting:
            status = "Waiting for your door"
        case .stopped:
            status = pairingRequired ? "Forget this door, then connect again" : "Auto-connect off"
        }
    }

    private func scheduleRetry() {
        retry?.cancel()
        let work = DispatchWorkItem { [weak self] in self?.resume() }
        retry = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 3, execute: work)
    }
}

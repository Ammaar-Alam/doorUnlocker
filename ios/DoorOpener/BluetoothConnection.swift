import CoreBluetooth
import Observation

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
    var candidates: [CBPeripheral] = []
    var entries: [String] = []
    private var central: CBCentralManager!
    private var door: CBPeripheral?
    private var retry: DispatchWorkItem?
    private let service = CBUUID(string: "180A")

    override init() {
        super.init()
        if pairingRequired { status = "Pair again in Bluetooth Settings" }
        central = CBCentralManager(delegate: self, queue: .main, options: [
            CBCentralManagerOptionRestoreIdentifierKey: "DoorOpener.connection",
            CBCentralManagerOptionShowPowerAlertKey: false
        ])
    }

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
            central.stopScan()
            if let door { central.cancelPeripheralConnection(door) }
            status = "Auto-connect off"
            log(status)
        }
    }

    func forgetDoor() {
        setEnabled(false)
        door?.delegate = nil
        door = nil
        UserDefaults.standard.removeObject(forKey: "doorID")
        candidates.removeAll()
        status = "No door selected"
        log("Saved door forgotten")
    }

    func select(_ peripheral: CBPeripheral) {
        central.stopScan()
        if let door, door.identifier != peripheral.identifier { central.cancelPeripheralConnection(door) }
        candidates.removeAll()
        door = peripheral
        UserDefaults.standard.set(peripheral.identifier.uuidString, forKey: "doorID")
        setEnabled(true)
    }

    func resume() {
        guard enabled, central.state == .poweredOn else { return }
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
        if !candidates.contains(where: { $0.identifier == peripheral.identifier }) { candidates.append(peripheral) }
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
            status = "Pair again in Bluetooth Settings"
            log(status)
        case .retry:
            status = "Waiting for your door"
            if peripheral.state == .connected { central.cancelPeripheralConnection(peripheral) }
            else { scheduleRetry() }
        case .waiting:
            status = "Waiting for your door"
        case .stopped:
            status = pairingRequired ? "Pair again in Bluetooth Settings" : "Auto-connect off"
        }
    }

    private func scheduleRetry() {
        retry?.cancel()
        let work = DispatchWorkItem { [weak self] in self?.resume() }
        retry = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 3, execute: work)
    }
}

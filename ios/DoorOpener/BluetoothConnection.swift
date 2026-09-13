import CoreBluetooth
import Observation

@Observable
final class BluetoothConnection: NSObject, CBCentralManagerDelegate, CBPeripheralDelegate {
    var enabled = UserDefaults.standard.bool(forKey: "autoConnect")
    var status = "Not connected"
    var candidates: [CBPeripheral] = []
    var entries: [String] = []
    private var central: CBCentralManager!
    private var door: CBPeripheral?
    private var retry: DispatchWorkItem?
    private let service = CBUUID(string: "180A")

    override init() {
        super.init()
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
        guard enabled else { central.cancelPeripheralConnection(peripheral); return }
        log("Connected to door")
        prepare(peripheral)
    }

    private func prepare(_ peripheral: CBPeripheral) {
        status = "Connected · checking pairing"
        peripheral.delegate = self
        peripheral.discoverServices([service])
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        guard error == nil, let service = peripheral.services?.first(where: { $0.uuid == self.service }) else {
            status = "Could not read door service"; log(status); return
        }
        peripheral.discoverCharacteristics([CBUUID(string: "2A24")], for: service)
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        guard error == nil, let model = service.characteristics?.first(where: { $0.uuid == CBUUID(string: "2A24") }) else {
            status = "Could not read door identity"; log(status); return
        }
        peripheral.readValue(for: model)
    }

    func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        guard error == nil, characteristic.value == Data("Door Opener".utf8) else {
            status = "Pairing or identity check failed"
            log(status)
            setEnabled(false)
            return
        }
        status = "Connected"
        log("Door identity verified")
    }

    func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, timestamp: CFAbsoluteTime, isReconnecting: Bool, error: Error?) {
        guard peripheral.identifier == door?.identifier else { return }
        status = enabled ? "Waiting for your door" : "Auto-connect off"
        log("Disconnected\(isReconnecting ? " · iOS is reconnecting" : "")")
        if enabled && !isReconnecting { scheduleRetry() }
    }

    func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
        guard peripheral.identifier == door?.identifier else { return }
        status = "Connection interrupted"
        log(error?.localizedDescription ?? status)
        if enabled { scheduleRetry() }
    }

    private func scheduleRetry() {
        retry?.cancel()
        let work = DispatchWorkItem { [weak self] in self?.resume() }
        retry = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 3, execute: work)
    }
}

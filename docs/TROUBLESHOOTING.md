# Troubleshooting Guide

## Common Issues and Solutions

### 1. Door Not Responding to Commands

**Symptoms:**
- Toggle switch doesn't affect the door
- No response from the system when trying to open/close

**Possible Solutions:**
- Check your internet connection
- Ensure the Arduino is powered on and connected to WiFi
- Verify that the correct Thing ID and Property ID are set in the .env file
- Restart the Node.js server

### 2. Authentication Issues

**Symptoms:**
- Unable to log in
- "Not authenticated" errors

**Possible Solutions:**
- Double-check the password in the .env file
- Clear browser cookies and cache
- Ensure AUTH_REQUIRED is set correctly in the .env file

### 3. Motor Not Moving

**Symptoms:**
- Commands are received but the door doesn't physically move

**Possible Solutions:**
- Check all physical connections between the Arduino, motor driver, and motor
- Verify the power supply to the motor is adequate (24V)
- Ensure the Arduino code is correctly uploaded and running
- Check jumper settings on the L298N motor driver (refer to L298N documentation)

### 4. Unexpected Door Behavior

**Symptoms:**
- Door opens when it should close or vice versa

**Possible Solutions:**
- Check the wiring between the motor driver and the motor
- Verify the logic in the Arduino code for interpreting open/close commands

### 5. Server Won't Start

**Symptoms:**
- Error messages when trying to start the Node.js server

**Possible Solutions:**
- Ensure all required environment variables are set in the .env file
- Check that all dependencies are installed (`npm install`)
- Verify Node.js is installed and up to date

### 6. High Latency in Door Response

**Symptoms:**
- Long delay between sending a command and the door responding

**Possible Solutions:**
- Check your internet connection speed
- Verify the Arduino's WiFi signal strength
- Optimize the server code for faster processing

### 7. Arduino Getting Stuck on `Serial.begin`

**Symptoms:**
- Arduino code doesn't progress past the `Serial.begin` line when not connected to a computer

**Solution:**
- Ensure the Arduino has a proper power source and is not relying on the serial connection for power

### 8. Power Supply Issues

**Symptoms:**
- Inconsistent behavior of Arduino or motor
- Components not working as expected

**Solution:**
- Use a DC-DC buck converter to step down voltage where necessary
- Ensure all components are rated for the supplied voltage
- Verify that the Arduino and motor driver can share a power supply without causing voltage issues

### 9. Connecting to Eduroam WiFi

**Symptoms:**
- Arduino unable to connect to the Eduroam network

**Solution:**
- Use WPA2 Enterprise settings
- Ensure the correct identity and credentials are used
- Refer to Eduroam setup guides for specific configuration details

### 10. Motor and Driver Compatibility Issues

**Symptoms:**
- Motor driver overheating
- Motor not working correctly with the driver

**Solution:**
- Ensure the motor and driver are compatible in terms of voltage and current ratings
- Use proper heat sinks if necessary to manage temperature

### 11. 5V Output Issues on Arduino Nano ESP32 Connect

**Symptoms:**
- 5V output not working on the Arduino

**Solution:**
- Solder the VUSB pads as shown in the Arduino documentation
- If soldering tools are not available, seek help from someone experienced

### 12. Miscellaneous Hardware Issues

**Symptoms:**
- Intermittent connections
- Unreliable operation

**Solution:**
- Regularly inspect and replace damaged wires
- Ensure all connections are secure
- Use proper wire stripping and connection techniques
- Be cautious when using breadboards and verify all connections

If you encounter issues not covered here, or if the suggested solutions don't resolve your problem, please create an issue on my GitHub repository with detailed information about the problem and any error messages you're seeing.

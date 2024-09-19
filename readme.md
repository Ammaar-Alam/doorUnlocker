# Automatic Dorm Door Opener

An innovative IoT project that revolutionizes dorm room access using cutting-edge technology. This system enables remote control of a physical door lock from anywhere in the world, showcasing a practical application of IoT in everyday life.

**Live At My Website:** [door.ammaar.xyz](https://door.ammaar.xyz)

This website allows anyone, anywhere in the world, to open or close my dorm room door in real-time. Personally, I've made iPhone shortcuts that use the site's API endpoints so that I can open or close my door right from the lockscreen, or even ask siri to do the same; I barely even remember the dorm-pin on my prox at this point :P

_[Watch it in action:](https://youtube.com/shorts/K_ev5bF7mhw?feature=share)_ <br>
<a href="https://youtube.com/shorts/K_ev5bF7mhw?feature=share">
  <img src="https://i.imgur.com/JOtGRpt.png" width="300"/>
</a>

## Project Overview

This advanced system integrates an Arduino Nano ESP32 Connect with a motor driver and DC motor to provide seamless, remote control of a dorm room door. By leveraging the Arduino IoT Cloud, it offers both WiFi and Bluetooth Low Energy (BLE) control options. For all intensive purposes, the BLE version is more than sufficient, but I chose to use the WiFi version as ~~the thought of some random dude in Russia stumbling across my site and opening my door was funny~~ I just thought it was cooler :)

## Features

- Global remote door control via Arduino IoT Cloud
- Intuitive web interface for easy access and control
- BLE support for local, low-energy control
- Real-time door status updates
- Emergency close function for quick security measures
- Optional password protection for enhanced security
- Responsive design for both desktop and mobile devices

## Technical Stack

- **Hardware:** Arduino Nano ESP32 Connect, L298N Motor Driver, 24V DC Motor
- **Backend:** Node.js, Express.js
- **Frontend:** HTML5, CSS3, JavaScript
- **IoT Platform:** Arduino IoT Cloud
- **Authentication:** JSON Web Tokens (JWT)
- **Version Control:** Git

## Installation

### Prerequisites

- Arduino Nano ESP32 Connect
- L298N Motor Driver
- 24V DC Motor
- Power supplies (24V for motor, 5V for Arduino)
- Node.js (v14 or later) and npm installed on your system

### Steps

1. Clone the repository:
```
git clone https://github.com/yourusername/smart-dorm-door.git
cd smart-dorm-door
```

2. Install dependencies: `npm install`

3. Set up your Arduino:
- Connect the hardware components according to the schematic in the `docs` folder
- Upload the Arduino sketch from the `arduino` folder to your Nano ESP32 Connect

4. Configure your environment variables:
- Copy `.env.example` to `.env`
- Fill in your Arduino IoT Cloud credentials and other configuration details

5. Start the server: `npm start`

## Usage

1. Access the web interface by navigating to `http://localhost:3000` (or your server's address)
2. Log in if authentication is enabled
3. Use the toggle switch to open or close the door
4. The emergency close button can be used to quickly secure the door

For more detailed usage instructions, check out my [User Guide](docs/USER_GUIDE.md).

## Configuration

The system can be configured using environment variables. Key configuration options include:

- `AUTH_REQUIRED`: Set to `true` to enable password protection
- `PASSWORD`: Set the password for accessing the control panel (if auth is enabled)
- `PORT`: The port on which the server will run (default: 3000)

For a full list of configuration options, see the `.env.example` file.

## API Endpoints

The system exposes several RESTful API endpoints:

- `POST /login`: Authenticate and receive a JWT token
- `POST /command`: Send open/close commands
- `POST /emergency-close`: Trigger an emergency close
- `GET /status`: Retrieve the current door status

For detailed API documentation, refer to my [API Guide](docs/API_GUIDE.md).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgements

- [Arduino IoT Cloud](https://create.arduino.cc/iot) for providing the IoT platform
- [Express.js](https://expressjs.com/) for the web server framework
- [node-fetch](https://github.com/node-fetch/node-fetch) for making HTTP requests in Node.js
- All contributors who have helped shape and improve this project

## Author

Ammaar Alam - [GitHub](https://github.com/yourusername) - [Website](https://ammaar.xyz) - [Check out my other portfolios/links](https://linktr.ee/a_alam)

#include <WiFiNINA.h>
#include <WiFiUdp.h>
#include <ArduinoHttpClient.h>

// Network credentials
const char SSID[] = "servicenet";
const char PASS[] = ""; // No password for the network

// Server details for login and data fetch
const char loginServer[] = "guest.princeton.edu";
const int loginPort = 80;
const char loginPage[] = "/login"; // Replace with the actual login page resource

const char apiServer[] = "jsonplaceholder.typicode.com";
const int apiPort = 80;
const char apiResource[] = "/todos/1";

// Create objects
WiFiClient wifiClient;
HttpClient loginClient = HttpClient(wifiClient, loginServer, loginPort);
HttpClient apiClient = HttpClient(wifiClient, apiServer, apiPort);

void setup() {
  Serial.begin(9600);

  // Wait for serial monitor to open
  while (!Serial) {
    ;
  }

  // Connect to WiFi
  Serial.print("Connecting to ");
  Serial.println(SSID);
  WiFi.begin(SSID, PASS);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi connected");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());

  // Log in to the captive portal
  if (loginToCaptivePortal()) {
    Serial.println("Logged in to captive portal.");
  } else {
    Serial.println("Failed to log in to captive portal.");
    return;
  }
}

void loop() {
  // Make HTTP GET request to the API
  Serial.println("Making GET request...");
  apiClient.get(apiResource);

  // Wait for response
  int statusCode = apiClient.responseStatusCode();
  String response = apiClient.responseBody();

  Serial.print("Status code: ");
  Serial.println(statusCode);
  Serial.print("Response: ");
  Serial.println(response);

  // Close connection
  apiClient.stop();

  // Wait 10 seconds before the next loop
  delay(10000);
}

bool loginToCaptivePortal() {
  // Step 1: Navigate to the login page (simulated)
  Serial.println("Navigating to login page...");
  loginClient.get(loginPage);

  // Wait for response
  int statusCode = loginClient.responseStatusCode();
  String response = loginClient.responseBody();

  Serial.print("Navigation status code: ");
  Serial.println(statusCode);
  Serial.print("Navigation response: ");
  Serial.println(response);

  // Check if we need to follow any redirects or handle forms (simplified assumption)
  // In reality, you may need to parse the response and follow hidden form elements or cookies.

  // Step 2: Submit login credentials
  String postData = "username=your_username&password=your_password&accept_terms=true"; // Replace with actual login parameters
  Serial.println("Submitting login credentials...");
  loginClient.post(loginPage, "application/x-www-form-urlencoded", postData);

  // Wait for response
  statusCode = loginClient.responseStatusCode();
  response = loginClient.responseBody();

  Serial.print("Login status code: ");
  Serial.println(statusCode);
  Serial.print("Login response: ");
  Serial.println(response);

  // Check if login was successful
  if (statusCode == 200 && response.indexOf("successful") != -1) {
    return true;
  }

  return false;
}

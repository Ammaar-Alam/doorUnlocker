import okhttp3.*;
import org.json.JSONObject;
import spark.Spark;

import java.io.IOException;

public class ArduinoCloudControl {

    private static final String BASE_URL = "https://api2.arduino.cc/iot/v2";
    private static final String CLIENT_ID = "LrCg71iVReH2gvzTxast5jGBe1dlhpX7";
    private static final String CLIENT_SECRET =
        "7KHl3gqG2joOzf5Uq5eCFAumyQj4TGxcT0QFrPuMjfJ6uMf3lO4PcJtaj1YX0Wg2";
    private static final String DEVICE_ID = "0f91b9e4-a0db-48b7-8bfd-83ebc031e134";
    private static final String PROPERTY_ID = "5b833938-8257-4c8a-9e35-f473a56d60f1";

    private OkHttpClient client;
    private String accessToken;

    public ArduinoCloudControl() {
        client = new OkHttpClient();
        authenticate();
    }

    public void authenticate() {
        RequestBody formBody = new FormBody.Builder()
            .add("grant_type", "client_credentials")
            .add("client_id", CLIENT_ID)
            .add("client_secret", CLIENT_SECRET)
            .build();

        Request request = new Request.Builder()
            .url("https://api2.arduino.cc/iot/v1/clients/token")
            .post(formBody)
            .build();

        try {
            Response response = client.newCall(request).execute();
            String responseBody = response.body().string();
            JSONObject json = new JSONObject(responseBody);
            accessToken = json.getString("access_token");
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    public void updateDoorStatus(String status) throws IOException {
        RequestBody body = RequestBody.create(
            MediaType.parse("application/json"),
            "{\"value\":\"" + status + "\"}"
        );

        Request request = new Request.Builder()
            .url(
                BASE_URL +
                "/things/" +
                DEVICE_ID +
                "/properties/" +
                PROPERTY_ID +
                "/publish"
            )
            .put(body)
            .addHeader("Authorization", "Bearer " + accessToken)
            .build();

        Response response = client.newCall(request).execute();
        System.out.println(response.body().string());
    }

    public static void main(String[] args) {
        ArduinoCloudControl control = new ArduinoCloudControl();

        // Set up Spark server to handle web requests
        Spark.port(4567);
        Spark.post("/controlDoor", (req, res) -> {
            JSONObject json = new JSONObject(req.body());
            String status = json.getString("doorStatus");

            control.updateDoorStatus(status);

            JSONObject responseJson = new JSONObject();
            responseJson.put("status", status);
            return responseJson.toString();
        });
    }
}

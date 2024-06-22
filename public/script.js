async function sendCommand(command) {
    try {
        const response = await fetch("/command", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ command }),
        });

        if (!response.ok) {
            const errorDetail = await response.text();
            console.error("Failed to send command:", errorDetail);
            return;
        }

        console.log(await response.text());
    } catch (error) {
        console.error("Error during the request:", error);
    }
}

function toggleSwitch(element) {
    const isChecked = element.checked;
    sendCommand(isChecked ? "true" : "false");
    document.querySelector(".status-open").style.color = isChecked ? "#FF4B4B" : "#888";
    document.querySelector(".status-closed").style.color = isChecked
        ? "#888"
        : "#4CAF50";
}

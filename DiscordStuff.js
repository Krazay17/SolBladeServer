export async function sendDiscordMessage(message) {
    const webhookURL = "https://discord.com/api/webhooks/1406792582197149699/xlWk4jLxvCzyILXd1E0OxcneZVhYz6Rjp8Z48A0EGtvl3rKusWT2lxCdvphSPohRqACL";

    const messageToSend = message;
    const playerName = "Server";
    const payload = {
        content: messageToSend, // plain text
        username: playerName,          // optional, overrides webhook name
        avatar_url: "https://conduit.bar/assets/CardScythe.png"
    };

    await fetch(webhookURL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })
}
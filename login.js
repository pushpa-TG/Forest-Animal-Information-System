const loginForm = document.getElementById("loginForm");

loginForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const message = document.getElementById("loginMessage");

    message.textContent = "Checking login...";

    try {
        const response = await fetch(
            "http://127.0.0.1:8080/login",
            {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded"
                },
                body: new URLSearchParams({
                    username: username,
                    password: password
                }).toString()
            }
        );

        if (response.ok) {
            message.textContent = "Login successful!";
            window.location.href = "index.html";
        } else {
            message.textContent = "Invalid username or password";
        }

    } catch (error) {
        message.textContent = "Cannot connect to Java backend";
        console.error(error);
    }
});
import java.sql.*;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpExchange;

public class AnimalBackend {

    static final String DB_URL =
        "jdbc:mysql://localhost:3306/forest_animal_db";
    static final String DB_USER = "root";
    static final String DB_PASSWORD = "";

    static final SecureRandom RANDOM = new SecureRandom();
    static final long SESSION_SECONDS = 3600;

    static final Map<String, Long> sessions =
        new ConcurrentHashMap<>();
    
    public static void main(String[] args) {
        try {
            HttpServer server = HttpServer.create(
                new InetSocketAddress("127.0.0.1", 8080), 0
            );

            server.createContext("/login", exchange -> {
                try {
                    if (preflight(exchange)) return;

                    if (!exchange.getRequestMethod().equals("POST")) {
                        send(exchange, 405,
                            "{\"error\":\"Method not allowed\"}");
                        return;
                    }

                    Map<String, String> data = readForm(exchange);

                    String username =
                        data.getOrDefault("username", "");
                    String password =
                        data.getOrDefault("password", "");

                    if (!checkLogin(username, password)) {
                        send(exchange, 401,
                            "{\"error\":\"Invalid username or password\"}");
                        return;
                    }

                    String token = newToken();

                    sessions.put(
                        token,
                        Instant.now().getEpochSecond()
                            + SESSION_SECONDS
                    );

                    exchange.getResponseHeaders().add(
                        "Set-Cookie",
                        "admin_session=" + token
                        + "; HttpOnly; SameSite=Strict; Path=/"
                        + "; Max-Age=" + SESSION_SECONDS
                    );

                    send(exchange, 200,
                        "{\"message\":\"Login successful\"}");

                } catch (Exception e) {
                    e.printStackTrace();
                    send(exchange, 500,
                        "{\"error\":\"Login failed\"}");
                }
            });

            server.createContext("/logout", exchange -> {
                if (preflight(exchange)) return;

                if (!exchange.getRequestMethod().equals("POST")) {
                    send(exchange, 405,
                        "{\"error\":\"Method not allowed\"}");
                    return;
                }

                String token = getSessionToken(exchange);
                if (token != null) sessions.remove(token);

                exchange.getResponseHeaders().add(
                    "Set-Cookie",
                    "admin_session=; HttpOnly; SameSite=Strict;"
                    + " Path=/; Max-Age=0"
                );

                send(exchange, 200,
                    "{\"message\":\"Logged out successfully\"}");
            });

            server.createContext("/session", exchange -> {
                if (preflight(exchange)) return;

                if (!exchange.getRequestMethod().equals("GET")) {
                    send(exchange, 405,
                        "{\"error\":\"Method not allowed\"}");
                    return;
                }

                if (isAuthenticated(exchange)) {
                    send(exchange, 200,
                        "{\"authenticated\":true}");
                } else {
                    send(exchange, 401,
                        "{\"authenticated\":false}");
                }
            });

            server.createContext("/animals", exchange -> {
                if (preflight(exchange)) return;

                String method = exchange.getRequestMethod();

                try {
                    if (method.equals("GET")) {
                        send(exchange, 200, getAnimals());
                        return;
                    }

                    // Only logged-in admins can change data.
                    if (!isAuthenticated(exchange)) {
                        send(exchange, 401,
                            "{\"error\":\"Admin login required\"}");
                        return;
                    }

                    if (method.equals("POST")) {
                        Map<String, String> data = readForm(exchange);
                        validateAnimal(data);
                        addAnimal(data);

                        send(exchange, 201,
                            "{\"message\":\"Animal added successfully\"}");

                    } else if (method.equals("PUT")) {
                        Map<String, String> data = readForm(exchange);
                        validateAnimal(data);

                        int id = parseId(data);

                        if (updateAnimal(id, data)) {
                            send(exchange, 200,
                                "{\"message\":\"Animal updated successfully\"}");
                        } else {
                            send(exchange, 404,
                                "{\"error\":\"Animal not found\"}");
                        }

                    } else if (method.equals("DELETE")) {
                        Map<String, String> data = readForm(exchange);
                        int id = parseId(data);

                        if (deleteAnimal(id)) {
                            send(exchange, 200,
                                "{\"message\":\"Animal deleted successfully\"}");
                        } else {
                            send(exchange, 404,
                                "{\"error\":\"Animal not found\"}");
                        }

                    } else {
                        send(exchange, 405,
                            "{\"error\":\"Method not allowed\"}");
                    }

                } catch (IllegalArgumentException e) {
    send(exchange, 400,
        "{\"error\":\"Invalid input\"}");
                } catch (Exception e) {
                    e.printStackTrace();
                    send(exchange, 500,
                        "{\"error\":\"Database operation failed\"}");
                }
            });

            server.start();

            System.out.println("Forest Animal Backend Started");
            System.out.println(
                "API running at http://localhost:8080/animals"
            );
            System.out.println(
                "Login API running at http://localhost:8080/login"
            );

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // CORS FOR LOCAL DEVELOPMENT
    static boolean preflight(HttpExchange exchange)
            throws java.io.IOException {

        String origin = exchange.getRequestHeaders()
            .getFirst("Origin");

        // Live Server normally uses port 5500 or 5501.
        if ("http://127.0.0.1:5500".equals(origin)
            || "http://localhost:5500".equals(origin)
            || "http://127.0.0.1:5501".equals(origin)
            || "http://localhost:5501".equals(origin)) {

            exchange.getResponseHeaders().set(
                "Access-Control-Allow-Origin", origin
            );
            exchange.getResponseHeaders().set(
                "Access-Control-Allow-Credentials", "true"
            );
            exchange.getResponseHeaders().set(
                "Vary", "Origin"
            );
            exchange.getResponseHeaders().set(
                "Access-Control-Allow-Methods",
                "GET, POST, PUT, DELETE, OPTIONS"
            );
            exchange.getResponseHeaders().set(
                "Access-Control-Allow-Headers",
                "Content-Type"
            );
        }

        if (exchange.getRequestMethod().equals("OPTIONS")) {
            exchange.sendResponseHeaders(204, -1);
            exchange.close();
            return true;
        }

        return false;
    }

    static void send(HttpExchange exchange, int status, String json)
            throws java.io.IOException {

        exchange.getResponseHeaders().set(
            "Content-Type",
            "application/json; charset=UTF-8"
        );

        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(status, bytes.length);

        try (var output = exchange.getResponseBody()) {
            output.write(bytes);
        }
    }

    static Map<String, String> readForm(HttpExchange exchange)
            throws java.io.IOException {

        String body = new String(
            exchange.getRequestBody().readAllBytes(),
            StandardCharsets.UTF_8
        );

        Map<String, String> data = new HashMap<>();

        for (String pair : body.split("&")) {
            String[] parts = pair.split("=", 2);

            String key = URLDecoder.decode(
                parts[0], StandardCharsets.UTF_8
            );

            String value = parts.length > 1
                ? URLDecoder.decode(
                    parts[1], StandardCharsets.UTF_8
                )
                : "";

            data.put(key, value);
        }

        return data;
    }

    // ADMIN LOGIN VERIFICATION
    static boolean checkLogin(String username, String password)
            throws Exception {

        String sql =
            "SELECT password_hash FROM admins WHERE username=?";

        try (
            Connection con = DriverManager.getConnection(
                DB_URL, DB_USER, DB_PASSWORD
            );
            PreparedStatement stmt = con.prepareStatement(sql)
        ) {
            stmt.setString(1, username);

            try (ResultSet rs = stmt.executeQuery()) {
                if (!rs.next()) return false;

                String saved = rs.getString("password_hash");
                String[] parts = saved.split("\\$");

                if (parts.length != 4
                    || !parts[0].equals("pbkdf2_sha256")) {
                    return false;
                }

                int iterations = Integer.parseInt(parts[1]);
                byte[] salt =
                    Base64.getDecoder().decode(parts[2]);
                byte[] expected =
                    Base64.getDecoder().decode(parts[3]);

                PBEKeySpec spec = new PBEKeySpec(
                    password.toCharArray(),
                    salt,
                    iterations,
                    expected.length * 8
                );

                byte[] actual;
                try {
                    actual = SecretKeyFactory.getInstance(
                        "PBKDF2WithHmacSHA256"
                    ).generateSecret(spec).getEncoded();
                } finally {
                    spec.clearPassword();
                }

                return MessageDigest.isEqual(expected, actual);
            }
        }
    }

    static String newToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder()
            .withoutPadding()
            .encodeToString(bytes);
    }

    static String getSessionToken(HttpExchange exchange) {
        String cookie = exchange.getRequestHeaders()
            .getFirst("Cookie");

        if (cookie == null) return null;

        for (String item : cookie.split(";")) {
            String part = item.trim();

            if (part.startsWith("admin_session=")) {
                return part.substring(
                    "admin_session=".length()
                );
            }
        }

        return null;
    }

    static boolean isAuthenticated(HttpExchange exchange) {
        String token = getSessionToken(exchange);

        if (token == null) return false;

        Long expiry = sessions.get(token);

        if (expiry == null) return false;

        if (Instant.now().getEpochSecond() >= expiry) {
            sessions.remove(token);
            return false;
        }

        return true;
    }

    // VIEW ANIMALS
    static String getAnimals() throws SQLException {
        StringBuilder json = new StringBuilder("[");
        String sql =
            "SELECT id, name, species, habitat, "
            + "food_habit, conservation_status, description "
            + "FROM animals";

        try (
            Connection con = DriverManager.getConnection(
                DB_URL, DB_USER, DB_PASSWORD
            );
            Statement stmt = con.createStatement();
            ResultSet rs = stmt.executeQuery(sql)
        ) {
            boolean first = true;

            while (rs.next()) {
                if (!first) json.append(",");
                first = false;

                json.append("{")
                    .append("\"id\":").append(rs.getInt("id"))
                    .append(",\"name\":\"")
                    .append(escape(rs.getString("name")))
                    .append("\",\"species\":\"")
                    .append(escape(rs.getString("species")))
                    .append("\",\"habitat\":\"")
                    .append(escape(rs.getString("habitat")))
                    .append("\",\"food_habit\":\"")
                    .append(escape(rs.getString("food_habit")))
                    .append("\",\"conservation_status\":\"")
                    .append(escape(rs.getString("conservation_status")))
                    .append("\",\"description\":\"")
                    .append(escape(rs.getString("description")))
                    .append("\"}");
            }
        }

        return json.append("]").toString();
    }

    static void validateAnimal(Map<String, String> data) {
        String[] fields = {
            "name", "species", "habitat",
            "food_habit", "conservation_status", "description"
        };

        for (String field : fields) {
            if (data.getOrDefault(field, "").trim().isEmpty()) {
                throw new IllegalArgumentException(
                    "Missing " + field
                );
            }
        }
    }

    // ADD ANIMAL
    static void addAnimal(Map<String, String> data)
            throws SQLException {

        String sql =
            "INSERT INTO animals "
            + "(name, species, habitat, food_habit, "
            + "conservation_status, description) "
            + "VALUES (?, ?, ?, ?, ?, ?)";

        try (
            Connection con = DriverManager.getConnection(
                DB_URL, DB_USER, DB_PASSWORD
            );
            PreparedStatement stmt = con.prepareStatement(sql)
        ) {
            setAnimalFields(stmt, data);
            stmt.executeUpdate();
        }
    }

    // UPDATE ANIMAL
    static boolean updateAnimal(int id, Map<String, String> data)
            throws SQLException {

        String sql =
            "UPDATE animals SET "
            + "name=?, species=?, habitat=?, food_habit=?, "
            + "conservation_status=?, description=? "
            + "WHERE id=?";

        try (
            Connection con = DriverManager.getConnection(
                DB_URL, DB_USER, DB_PASSWORD
            );
            PreparedStatement stmt = con.prepareStatement(sql)
        ) {
            setAnimalFields(stmt, data);
            stmt.setInt(7, id);

            return stmt.executeUpdate() > 0;
        }
    }

    // DELETE ANIMAL
    static boolean deleteAnimal(int id) throws SQLException {
        String sql = "DELETE FROM animals WHERE id=?";

        try (
            Connection con = DriverManager.getConnection(
                DB_URL, DB_USER, DB_PASSWORD
            );
            PreparedStatement stmt = con.prepareStatement(sql)
        ) {
            stmt.setInt(1, id);
            return stmt.executeUpdate() > 0;
        }
    }

    static void setAnimalFields(
            PreparedStatement stmt,
            Map<String, String> data
    ) throws SQLException {

        String[] fields = {
            "name", "species", "habitat",
            "food_habit", "conservation_status", "description"
        };

        for (int i = 0; i < fields.length; i++) {
            stmt.setString(
                i + 1, data.get(fields[i]).trim()
            );
        }
    }

    static int parseId(Map<String, String> data) {
        int id = Integer.parseInt(
            data.getOrDefault("id", "0")
        );

        if (id <= 0) {
            throw new IllegalArgumentException("Invalid ID");
        }

        return id;
    }

    static String escape(String value) {
        if (value == null) return "";

        return value.replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r")
            .replace("\t", "\\t")
            .replace("\b", "\\b")
            .replace("\f", "\\f");
    }
}
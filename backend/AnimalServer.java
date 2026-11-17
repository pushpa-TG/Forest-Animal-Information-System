import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpExchange;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;

public class AnimalServer {
    public static void main(String[] args) throws IOException {
        HttpServer server = HttpServer.create(
            new InetSocketAddress(8080), 0
        );

        server.createContext("/animals", (HttpExchange exchange) -> {
            String response = "[{\"name\":\"Tiger\"},{\"name\":\"Elephant\"}]";

            exchange.getResponseHeaders().set(
                "Content-Type", "application/json"
            );
            exchange.getResponseHeaders().set(
                "Access-Control-Allow-Origin", "*"
            );

            byte[] data = response.getBytes(
                java.nio.charset.StandardCharsets.UTF_8
            );
            exchange.sendResponseHeaders(200, data.length);

            try (OutputStream os = exchange.getResponseBody()) {
                os.write(data);
            }
        });

        server.start();
        System.out.println("Animal API started at http://localhost:8080/animals");
    }
}
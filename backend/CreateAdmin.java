import java.sql.*;
import java.util.Scanner;
import java.security.SecureRandom;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

public class CreateAdmin {

    public static void main(String[] args) {

        String url = "jdbc:mysql://localhost:3306/forest_animal_db";

        try (Scanner sc = new Scanner(System.in)) {

            System.out.print("Enter admin username: ");
            String username = sc.nextLine().trim();

            System.out.print("Enter admin password: ");
            String password = sc.nextLine();

            if (username.isEmpty() || password.length() < 12) {
                System.out.println(
                    "Username required. Password must be at least 12 characters."
                );
                return;
            }

            byte[] salt = new byte[16];
            new SecureRandom().nextBytes(salt);

            int iterations = 600000;

            PBEKeySpec spec = new PBEKeySpec(
                password.toCharArray(), salt, iterations, 256
            );

            byte[] hash;
            try {
                SecretKeyFactory factory =
                    SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");

                hash = factory.generateSecret(spec).getEncoded();
            } finally {
                spec.clearPassword();
            }

            String passwordHash = "pbkdf2_sha256$" + iterations + "$"
                + Base64.getEncoder().encodeToString(salt) + "$"
                + Base64.getEncoder().encodeToString(hash);

            String sql =
                "INSERT INTO admins (username, password_hash) VALUES (?, ?)";

            try (
                Connection con = DriverManager.getConnection(
                    url, "root", ""
                );
                PreparedStatement stmt = con.prepareStatement(sql)
            ) {
                stmt.setString(1, username);
                stmt.setString(2, passwordHash);
                stmt.executeUpdate();

                System.out.println("Admin account created successfully!");
            }

        } catch (Exception e) {
            System.out.println("Unable to create admin account.");
            e.printStackTrace();
        }
    }
}
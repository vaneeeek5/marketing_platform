import NextAuth, { NextAuthOptions, User, Session } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

// Extend the built-in Session type to include 'role'
declare module "next-auth" {
    interface Session {
        user: {
            id?: string;
            name?: string | null;
            email?: string | null;
            image?: string | null;
            role?: string;
        }
    }
    interface User {
        id: string; // User.id is usually string
        role?: string;
    }
}

// Extend the JWT type to include 'role'
declare module "next-auth/jwt" {
    interface JWT {
        role?: string;
    }
}


// Hardcoded users for Phase 1. 
// In Phase 2, this will be replaced by reading from the Master Sheet/Database.
const users = [
    {
        id: "1",
        name: "Admin User",
        email: "admin@example.com",
        passwordHash: "$2a$10$X7X7X7X7X7X7X7X7X7X7X7X7X7X7X7X7X7X7X7X7X7X7X7X7X7", // placeholder, will use real hash later
        role: "admin",
    },
    {
        id: "2",
        name: "Client User",
        email: "client@example.com",
        passwordHash: "$2a$10$X7X7X7X7X7X7X7X7X7X7X7X7X7X7X7X7X7X7X7X7X7X7X7X7X7", // placeholder
        role: "client",
    }
];

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email", placeholder: "admin@example.com" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) return null;

                // 1. Find user
                // For now, simpler matching. In production, use bcrypt.compare
                // We'll treat the password as plain text for this very first verification step 
                // until I generate real hashes for you.

                // TODO: Replace with real DB lookup
                // const user = users.find(u => u.email === credentials.email);

                // Temporary Hardcoded Logic for Demonstration:
                if (credentials.email === "admin@example.com" && credentials.password === "admin123") {
                    return { id: "1", name: "Administrator", email: "admin@example.com", role: "admin" };
                }
                if (credentials.email === "client@example.com" && credentials.password === "client123") {
                    return { id: "2", name: "Client", email: "client@example.com", role: "client" };
                }

                return null;
            }
        })
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.role = user.role;
            }
            return token;
        },
        async session({ session, token }) {
            if (session?.user) {
                session.user.role = token.role;
            }
            return session;
        }
    },
    pages: {
        signIn: '/login', // Custom login page
    },
    session: {
        strategy: "jwt",
    },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

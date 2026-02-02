import { toast } from "sonner";

export function successNotification(message: string) {
    // Attempt to play sound
    try {
        const audio = new Audio("/sounds/success.mp3");
        audio.volume = 0.5;
        audio.play().catch((e) => {
            // Internal play promise rejection (e.g. no interaction) is expected
            console.log("Audio play failed (user interaction needed):", e);
        });
    } catch (e) {
        // Ignore audio errors
    }

    // Show toast
    toast.success(message, {
        duration: 4000,
        closeButton: true,
    });
}

import { render, screen } from "@testing-library/react";
import App from "./App";

test("Uygulama harita UI��n� a�ar", async () => {
    render(<App />);
    const toggle = await screen.findByRole("switch");
    expect(toggle).toBeInTheDocument();
});

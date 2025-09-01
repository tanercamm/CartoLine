import { render, screen } from "@testing-library/react";
import App from "./App";

test("Uygulama harita UI’ýný açar", async () => {
    render(<App />);
    const toggle = await screen.findByRole("switch");
    expect(toggle).toBeInTheDocument();
});

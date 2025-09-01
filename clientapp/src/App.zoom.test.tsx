import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

test("Zoom in/out görünüyor ve tıklanabiliyor", async () => {
    const user = userEvent.setup();
    render(<App />);

    const zoomIn = await screen.findByRole("button", { name: /zoom in/i });
    const zoomOut = screen.getByRole("button", { name: /zoom out/i });

    await user.click(zoomIn);
    await user.click(zoomOut);

    expect(zoomIn).toBeEnabled();
    expect(zoomOut).toBeEnabled();
});

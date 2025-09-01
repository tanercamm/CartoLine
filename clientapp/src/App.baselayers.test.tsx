import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

test("OSM/Uydu/Topo preset butonları görünüyor ve tıklanabiliyor", async () => {
    const user = userEvent.setup();
    render(<App />);

    const osm = await screen.findByRole("button", { name: /harita \(osm\)/i });
    const sat = screen.getByRole("button", { name: /uydu görünümü/i });
    const topo = screen.getByRole("button", { name: /topo görünümü/i });

    await user.click(sat);
    await user.click(topo);
    await user.click(osm);

    // render + interaction tarafından görünür olmalı
    expect(osm).toBeInTheDocument();
});

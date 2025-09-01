import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

test("Çizim başlat/iptal akışı çalışır", async () => {
    const user = userEvent.setup();
    render(<App />);

    // UI hazır
    await screen.findByRole("switch");

    // Başta iptal pasif
    const cancel = screen.getByRole("button", { name: /İptal/i });
    expect(cancel).toBeDisabled();

    // Yeni çizim → Ön modal gelir
    const add = screen.getByRole("button", { name: /Yeni çizim/i });
    await user.click(add);
    const preTitle = await screen.findByText(/Çizim Ayarları/i);
    expect(preTitle).toBeInTheDocument();

    // Çizime Başla → Chip aktif
    await user.click(screen.getByRole("button", { name: /Çizime Başla/i }));
    expect(await screen.findByText(/Çizim: Aktif/i)).toBeInTheDocument();
    expect(cancel).not.toBeDisabled();

    // ESC ile iptal → Chip pasif
    await user.keyboard("{Escape}");
    expect(await screen.findByText(/Çizim: Kapalı/i)).toBeInTheDocument();
    expect(cancel).toBeDisabled();
});

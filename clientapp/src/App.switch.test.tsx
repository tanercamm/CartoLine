import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import App from "./App"

test("Veri katmanı switch’i aç/kapa çalışıyor", async () => {
    const user = userEvent.setup()
    render(<App />)
    const sw = await screen.findByRole("switch")
    const initial = sw.getAttribute("aria-checked")
    await user.click(sw)
    expect(sw.getAttribute("aria-checked")).not.toBe(initial)
})

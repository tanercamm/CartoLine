import { render, screen } from "@testing-library/react";
import TurkeyMap from "./TurkeyMap";
import "../test/mockOpenLayers";

it("harita UI’si render oluyor", () => {
    render(
        <TurkeyMap
            onDrawEnd={() => { }}
            drawing={false}
            stopSignal={0}
            onNewClick={() => { }}
            onCancelClick={() => { }}
            currentType="road"
            lines={[]}
        />
    );

    expect(screen.getByRole("button", { name: /harita \(osm\)/i })).toBeInTheDocument();
    expect(screen.getByText(/çizim:\s*kapalı/i)).toBeInTheDocument();
});

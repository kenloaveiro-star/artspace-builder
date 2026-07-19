import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import KidsFloorExplorer from "./KidsFloorExplorer";

describe("KidsFloorExplorer", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the walking character during a floor change", () => {
    vi.useFakeTimers();

    render(
      <MemoryRouter>
        <KidsFloorExplorer />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /3F.*故事樓|故事樓.*3F/i }));

    act(() => {
      vi.advanceTimersByTime(450);
    });

    expect(screen.getByText("人仔行緊")).toBeInTheDocument();
    expect(screen.getByText("去緊 3F 樓")).toBeInTheDocument();
  });
});

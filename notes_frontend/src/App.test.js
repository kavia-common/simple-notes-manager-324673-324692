import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders notes app brand", () => {
  render(<App />);
  expect(screen.getByText("Notes")).toBeInTheDocument();
});

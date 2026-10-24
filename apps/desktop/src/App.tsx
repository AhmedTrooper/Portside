import { Theme } from "@astryxdesign/core/theme";
import { y2kTheme } from "./themes/y2k/y2kTheme";
import HomePage from "./features/home/HomePage";

function App() {
  return (
    <Theme theme={y2kTheme}>
      <HomePage />
    </Theme>
  );
}

export default App;

import { VStack } from "@astryxdesign/core/Stack";
import { Link } from "@astryxdesign/core/Link";
import { openUrl } from "@tauri-apps/plugin-opener";

const REPOSITORY_URL = "https://github.com/AhmedTrooper/Portside";

export function AboutPage() {
  return (
    <VStack padding={3} className="w-full min-w-0">
      <Link
        href={REPOSITORY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="min-w-0 max-w-full [overflow-wrap:anywhere]"
        onClick={event => {
          event.preventDefault();
          void openUrl(REPOSITORY_URL).catch(error => console.error("Could not open repository", error));
        }}
      >
        {REPOSITORY_URL}
      </Link>
    </VStack>
  );
}

export default AboutPage;

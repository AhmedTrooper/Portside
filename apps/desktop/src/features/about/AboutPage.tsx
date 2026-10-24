import { useState } from "react";
import { Heading, Text, VStack, Card, Button, TextArea, HStack, Badge } from "@astryxdesign/core";
import { useAppTheme } from "../../context/ThemeContext";

export function AboutPage() {
  const { mode, toggleMode, customThemeJson, setCustomThemeJson, clearCustomTheme } = useAppTheme();
  const [jsonInput, setJsonInput] = useState(customThemeJson);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleApply = () => {
    const success = setCustomThemeJson(jsonInput);
    if (success) {
      setStatusMessage({ type: "success", text: "Custom theme applied and saved to localStorage!" });
    } else {
      setStatusMessage({ type: "error", text: "Invalid JSON theme format. Please check your input." });
    }
  };

  const handleReset = () => {
    clearCustomTheme();
    setJsonInput("");
    setStatusMessage({ type: "success", text: "Reset to default Y2K theme." });
  };

  return (
    <VStack className="gap-4 p-6">
      <Heading level={1}>About Portside</Heading>
      <Text type="body" color="secondary">
        Portside is a streamlined platform for managing cloud infrastructure, deployments, and observability.
      </Text>

      <Card className="p-4 mt-4">
        <VStack className="gap-3">
          <Heading level={3}>Theme Settings</Heading>
          <HStack className="gap-3 items-center">
            <Text type="supporting">Active Mode:</Text>
            <Badge variant="info" label={mode.toUpperCase()} />
            <Button variant="secondary" size="sm" onClick={toggleMode} label={`Toggle to ${mode === "dark" ? "Light" : "Dark"} Mode`} />
          </HStack>
        </VStack>
      </Card>

      <Card className="p-4 mt-2">
        <VStack className="gap-3">
          <Heading level={3}>Custom Theme JSON (localStorage)</Heading>
          <Text type="supporting" color="secondary">
            Paste a custom Astryx theme JSON object below to override token variables and component styles.
          </Text>
          <TextArea
            label="JSON Input"
            value={jsonInput}
            onChange={(val) => setJsonInput(val)}
            placeholder='{\n  "name": "my-theme",\n  "tokens": {\n    "--color-accent": ["#0077B6", "#48CAE4"]\n  }\n}'
            rows={8}
            className="font-mono text-xs w-full"
          />
          {statusMessage && (
            <Badge variant={statusMessage.type === "success" ? "success" : "error"} label={statusMessage.text} />
          )}
          <HStack className="gap-2">
            <Button variant="primary" size="sm" onClick={handleApply} label="Save & Apply Custom Theme" />
            <Button variant="ghost" size="sm" onClick={handleReset} label="Reset Theme" />
          </HStack>
        </VStack>
      </Card>

      <Card className="p-4 mt-2">
        <VStack className="gap-2">
          <Heading level={3}>Version & Info</Heading>
          <Text type="supporting">System Version: 1.0.0</Text>
          <Text type="supporting">Environment: Production</Text>
        </VStack>
      </Card>
    </VStack>
  );
}

export default AboutPage;

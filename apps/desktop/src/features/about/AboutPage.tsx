import { useState } from "react";
import { Heading, Text, VStack, Card, Button, TextArea, HStack, Badge } from "@astryxdesign/core";
import { useAppTheme } from "../../context/ThemeContext";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { author, version } from "../../../package.json";
import { DockerCardGrid } from "../docker/shared/DockerCard";

export function AboutPage() {
  const { mode, toggleMode, customThemeJson, setCustomThemeJson, clearCustomTheme, activeTheme } = useAppTheme();
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
    <VStack gap={4} className="p-3 sm:p-6 w-full min-w-0">
      <Heading level={1}>About Portside</Heading>
      <Text type="body" color="secondary" display="block" className="docker-card-text">
        Portside is a desktop app by {author} for managing Docker images, containers, networks, volumes, and Compose projects using the Docker CLI.
      </Text>
      <Link to="/docker" className="inline-flex items-center gap-2 font-semibold hover:underline">Go to Docker management <ArrowUpRight size={16} aria-hidden /></Link>

      <DockerCardGrid>
      <Card padding={4} elevation="low" className="min-w-0">
        <VStack gap={2}>
          <Heading level={3}>Portside</Heading>
          <Text type="supporting" display="block">Author: {author}</Text>
          <Text type="supporting" display="block">Version: {version}</Text>
          <Text type="supporting" display="block">Build: {import.meta.env.MODE}</Text>
          <Text type="supporting" display="block" className="docker-card-text">Built with Tauri, React, TypeScript, and Astryx. Docker data is read locally and refreshed after actions.</Text>
        </VStack>
      </Card>
      <Card padding={4} elevation="low" className="min-w-0">
        <VStack gap={2}>
          <Heading level={3}>Theme Settings</Heading>
          <Text type="supporting" display="block">Theme: {activeTheme.name}</Text>
          <HStack gap={1} wrap="wrap" align="center">
            <Text type="supporting">Active Mode:</Text>
            <Badge variant="info" label={mode.toUpperCase()} />
            <Button variant="secondary" size="sm" onClick={toggleMode} label={`Use ${mode === "dark" ? "Light" : "Dark"} Mode`} />
          </HStack>
        </VStack>
      </Card>
      </DockerCardGrid>

      <Card padding={4} elevation="low" className="w-full min-w-0">
        <VStack gap={2}>
          <Heading level={3}>Custom Astryx Theme</Heading>
          <Text type="supporting" color="secondary" display="block" className="docker-card-text">
            Override theme tokens and component styles with JSON. Your saved theme stays on this device.
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
            <Text display="block" role={statusMessage.type === "error" ? "alert" : "status"} className="docker-card-text">{statusMessage.text}</Text>
          )}
          <HStack gap={1} wrap="wrap">
            <Button variant="primary" size="sm" onClick={handleApply} label="Save & Apply" />
            <Button variant="ghost" size="sm" onClick={handleReset} label="Reset Theme" />
          </HStack>
        </VStack>
      </Card>

    </VStack>
  );
}

export default AboutPage;

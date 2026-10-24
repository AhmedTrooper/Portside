import { useId, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Button } from "@astryxdesign/core/Button";
import { Text, Heading } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/Stack";
import { DockerFormDialog } from "../shared/DockerFormDialog";
import { DockerCard, DockerCardGrid } from "../shared/DockerCard";
import { stringifyError } from "../shared/types";

interface SearchResult { Name: string; Description: string; StarCount?: string | number; IsOfficial?: string | boolean; }
export function SearchImagesDialog({ onClose, onPull }: { onClose: () => void; onPull: (repository: string) => void }) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const search = async () => {
    if (busy) return;
    if (!query.trim()) { setError("Enter an image name to search for."); return; }
    setBusy(true); setError(null);
    try {
      const raw: unknown = await invoke("docker_search_images", { query: query.trim() });
      if (!Array.isArray(raw)) throw new Error("Unexpected registry search response.");
      setResults(raw.filter((item): item is SearchResult => !!item && typeof item === "object" && typeof item.Name === "string" && typeof item.Description === "string"));
    } catch (e) { setError(stringifyError(e)); }
    finally { setBusy(false); }
  };
  return (
    <DockerFormDialog isOpen title="Search Docker Hub" actionLabel="Search" onClose={onClose} onSubmit={() => void search()} isLoading={busy} width={820}>
      <VStack gap={2}>
        <TextInput id={id} label="Search term" value={query} onChange={setQuery} onEnter={() => void search()} isDisabled={busy} />
        {error && <Text display="block" role="alert" className="docker-card-text">{error}</Text>}
        {results?.length === 0 && <Text>No matching images found.</Text>}
        {results && <DockerCardGrid>{results.map(result => (
          <DockerCard key={result.Name}>
            <Heading level={4} className="docker-card-text">{result.Name}</Heading>
            <Text type="supporting" display="block" className="docker-card-text">{result.Description}</Text>
            <Text type="supporting">{result.StarCount ?? 0} stars{result.IsOfficial === true || result.IsOfficial === "true" ? " · Official image" : ""}</Text>
            <Button label="Pull" variant="secondary" onClick={() => { onPull(result.Name); onClose(); }} />
          </DockerCard>
        ))}</DockerCardGrid>}
      </VStack>
    </DockerFormDialog>
  );
}

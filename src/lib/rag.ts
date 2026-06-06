import { embedText } from "./voyage";
import { supabase } from "./supabase";

type Document = {
  id: number;
  source: string;
  school_name: string | null;
  title: string | null;
  content: string;
  url: string | null;
  similarity: number;
};

export async function retrieveContext(query: string): Promise<string> {
  const embedding = await embedText(query);

  const { data, error } = await supabase.rpc("match_documents", {
    query_embedding: embedding,
    match_threshold: 0.45,
    match_count: 6,
  });

  if (error || !data?.length) return "";

  return (data as Document[])
    .map((doc) => {
      const tag = doc.school_name ? `[Okul: ${doc.school_name}]` : `[${doc.source}]`;
      const title = doc.title ? `${doc.title}\n` : "";
      return `${tag}\n${title}${doc.content}`;
    })
    .join("\n\n---\n\n");
}

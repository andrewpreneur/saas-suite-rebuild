import type { ReactNode } from "react";
import { CopilotPromptBox } from "@/components/premium/copilot/CopilotPromptBox";

interface Props {
  placeholder: string;
  disabled?: boolean;
  onSend: (text: string) => void | "kept" | Promise<void | "kept">;
  onVoice?: () => void;
  autoFocus?: boolean;
  initialValue?: string;
  leading?: ReactNode;
}

/** The workspace composer: the brand prompt box. Grows a line at a time, then scrolls. */
export function Composer({ placeholder, disabled, onSend, onVoice, autoFocus = true, initialValue = "", leading }: Props) {
  return (
    <CopilotPromptBox
      placeholder={placeholder}
      disabled={disabled}
      onSend={(text) => onSend(text)}
      onVoice={onVoice}
      autoFocus={autoFocus}
      initialValue={initialValue}
      leading={leading}
    />
  );
}

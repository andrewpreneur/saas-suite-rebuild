import { useEffect } from "react";

const AFTERPARTY_URL = "https://link.saassuite.ai/events/event-details/6adce605ddad8a9a1a6fe07a";

const AfterParty = () => {
  useEffect(() => {
    window.location.href = AFTERPARTY_URL;
  }, []);

  return null;
};

export default AfterParty;

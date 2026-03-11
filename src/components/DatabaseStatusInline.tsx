import { useState, useEffect } from "react";
import { CheckCircle, XCircle, Loader2, Database } from "lucide-react";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { projectId, publicAnonKey } from "../utils/supabase/info";

type ConnectionStatus = "checking" | "connected" | "error";

export function DatabaseStatusInline() {
  const [status, setStatus] = useState<ConnectionStatus>("checking");
  const [message, setMessage] = useState("Checking connection...");

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-f8b491be/health`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${publicAnonKey}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (response.ok) {
          setStatus("connected");
          setMessage("Database connected");
        } else {
          setStatus("error");
          setMessage(`Server returned ${response.status}`);
        }
      } catch (err) {
        setStatus("error");
        setMessage("Unable to reach server");
      }
    };

    checkConnection();
  }, []);

  const statusConfig = {
    checking: {
      icon: <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />,
      variant: "outline" as const,
    },
    connected: {
      icon: <CheckCircle className="h-4 w-4 text-green-500" />,
      variant: "outline" as const,
    },
    error: {
      icon: <XCircle className="h-4 w-4 text-red-500" />,
      variant: "destructive" as const,
    },
  };

  const config = statusConfig[status];

  return (
    <Card className="p-3">
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Database</span>
      </div>
      <div className="flex items-center gap-2 mt-2">
        {config.icon}
        <span className="text-xs text-muted-foreground">{message}</span>
      </div>
    </Card>
  );
}

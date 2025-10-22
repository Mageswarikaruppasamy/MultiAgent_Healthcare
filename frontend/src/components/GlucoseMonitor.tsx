import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { healthcareApi, CGMData } from "@/services/api";
import { Droplet, TrendingUp, TrendingDown, Minus, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface GlucoseMonitorProps {
  userId: number;
}

export const GlucoseMonitor = ({ userId }: GlucoseMonitorProps) => {
  const [latestReading, setLatestReading] = useState<CGMData | null>(null);
  const [loading, setLoading] = useState(true);
  const [glucoseInput, setGlucoseInput] = useState("");
  const [logging, setLogging] = useState(false);

  useEffect(() => {
    const fetchGlucose = async () => {
      try {
        const response = await healthcareApi.getCGMStats(userId);
        if (response.success && response.data && response.data.length > 0) {
          setLatestReading(response.data[response.data.length - 1]);
        }
      } catch (error) {
        console.error("Error fetching glucose data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchGlucose();
  }, [userId]);

  const getGlucoseStatus = (glucose?: number) => {
    if (!glucose)
      return { status: "Unknown", color: "text-gray-500", icon: Minus };
    if (glucose < 70)
      return { status: "Low", color: "text-red-600", icon: TrendingDown };
    if (glucose > 140)
      return { status: "High", color: "text-orange-600", icon: TrendingUp };
    return { status: "Normal", color: "text-green-600", icon: Minus };
  };

  const handleLogGlucose = async () => {
    if (!glucoseInput.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a glucose value.",
        variant: "destructive",
      });
      return;
    }

    const glucoseValue = parseInt(glucoseInput);
    if (isNaN(glucoseValue) || glucoseValue < 50 || glucoseValue > 500) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid glucose value between 50-500 mg/dL.",
        variant: "destructive",
      });
      return;
    }

    setLogging(true);
    try {
      const response = await healthcareApi.logCGM(userId, glucoseValue);
      if (response.success) {
        toast({
          title: "Glucose Logged",
          description: response.message || "Your glucose reading has been recorded successfully."
        });
        // Update the latest reading
        setLatestReading({
          glucose: glucoseValue,
          timestamp: new Date().toISOString(),
        });
        setGlucoseInput("");
      } else {
        toast({
          title: "Error",
          description: response.message || "Failed to log glucose reading.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Connection Error",
        description: "Unable to log glucose reading. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLogging(false);
    }
  };

  const status = getGlucoseStatus(latestReading?.glucose);
  const StatusIcon = status.icon;

  if (loading) {
    return (
      <Card className="shadow-elegant">
        <CardContent className="flex items-center justify-center h-[300px]">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Glucose Card */}
      <Card
        className={`shadow-xl border-0 transition-all duration-500 hover:shadow-2xl ${
          status.status === "Low"
            ? "bg-gradient-to-r from-red-100 to-red-200"
            : status.status === "High"
            ? "bg-gradient-to-r from-orange-100 to-yellow-100"
            : status.status === "Normal"
            ? "bg-gradient-to-r from-emerald-100 to-green-200"
            : "bg-gradient-to-r from-gray-100 to-gray-200"
        }`}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-800">
            <Droplet className={`h-5 w-5 ${status.color}`} />
            Current Glucose Level
          </CardTitle>
          <CardDescription className="text-sm text-gray-600">
            {latestReading
              ? `Last updated: ${new Date(
                  latestReading.timestamp
                ).toLocaleString()}`
              : "No data available"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {latestReading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="flex items-center justify-center gap-3 mb-4">
                <StatusIcon className={`h-12 w-12 ${status.color}`} />
                <div className="text-center">
                  <p className={`text-6xl font-extrabold ${status.color}`}>
                    {latestReading.glucose}
                  </p>
                  <p className="text-lg text-gray-600 font-medium">mg/dL</p>
                </div>
              </div>
              <p
                className={`text-2xl font-semibold tracking-wide ${status.color}`}
              >
                {status.status}
              </p>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No glucose readings available yet
            </div>
          )}
        </CardContent>
      </Card>

      {/* Glucose Logging Form */}
      <Card className="shadow-elegant">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Log Glucose Reading
          </CardTitle>
          <CardDescription>Enter your current blood glucose level</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              type="number"
              value={glucoseInput}
              onChange={(e) => setGlucoseInput(e.target.value)}
              placeholder="e.g., 120"
              min="50"
              max="500"
              disabled={logging}
              className="flex-1"
            />
            <span className="flex items-center text-muted-foreground">mg/dL</span>
            <Button onClick={handleLogGlucose} disabled={logging}>
              {logging ? "Logging..." : "Log"}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Enter a value between 50-500 mg/dL
          </p>
        </CardContent>
      </Card>

      {/* Reference Ranges Card */}
      <Card className="shadow-md border-0 bg-gradient-to-br from-slate-50 to-slate-100">
        <CardHeader>
          <CardTitle className="text-lg text-gray-800 font-semibold">
            Reference Ranges
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-red-50 to-red-100 shadow-sm">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-600" />
                <span className="font-medium text-red-600">Low</span>
              </div>
              <span className="text-sm text-gray-500">&lt; 70 mg/dL</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-emerald-50 to-green-100 shadow-sm">
              <div className="flex items-center gap-2">
                <Minus className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-600">Normal</span>
              </div>
              <span className="text-sm text-gray-500">70–140 mg/dL</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-orange-50 to-yellow-100 shadow-sm">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-orange-600" />
                <span className="font-medium text-orange-600">High</span>
              </div>
              <span className="text-sm text-gray-500">&gt; 140 mg/dL</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
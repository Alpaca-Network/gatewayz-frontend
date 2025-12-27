import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";
// import { supabase } from "@/integrations/supabase/client";
import SuccessPopup from "./SuccessPopup";
import { trackTwitterSignupClick } from "@/components/analytics/twitter-pixel";

const schema = z.object({
  email: z.string().email("Please enter a valid email"),
  useCase: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface WaitlistFormProps {
  compact?: boolean;
}

export default function WaitlistForm({ compact = false }: WaitlistFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const [submitted, setSubmitted] = useState(false);
  const [useCaseValue, setUseCaseValue] = useState<string | undefined>(undefined);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");

  const onSubmit = async (data: FormData) => {
    // Track Twitter conversion for ad attribution
    trackTwitterSignupClick();

    try {
      const payload = {
        email: data.email,
        useCase: useCaseValue,
        pageUrl: typeof window !== "undefined" ? window.location.href : "",
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      };
      // TODO: Re-enable when supabase integration is configured
      // const { data: fnData, error } = await supabase.functions.invoke("send-waitlist-email", {
      //   body: payload,
      // });
      const fnData = null;
      const error = null; // Placeholder until supabase is configured
      if (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error("send-waitlist-email error:", error);
        }
        toast({
          title: "Something went wrong",
          description: "Please try again in a moment.",
          variant: "destructive",
        });
        return;
      }
      if (process.env.NODE_ENV === 'development') {
        console.log("Waitlist signup:", payload, fnData);
      }
      setSubmitted(true);
      setUserEmail(data.email);
      reset();
      setShowSuccessPopup(true);
    } catch (err: any) {
      if (process.env.NODE_ENV === 'development') {
        console.error("Waitlist submit failed:", err);
      }
      toast({
        title: "Submission failed",
        description: "Please try again shortly.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className={compact ? "w-full" : "max-w-xl w-full"} aria-label="Join the Gatewayz waitlist">
        {compact && (
          <h3 className="text-2xl md:text-3xl font-semibold text-gray-900 mb-4 text-center">
            Join our waitlist to stay up to date
          </h3>
        )}
        <div className={compact ? "flex flex-col gap-4" : "grid gap-3"}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@company.com" aria-invalid={!!errors.email} required {...register("email")} />
            {errors.email && (
              <span className="text-sm text-destructive">{errors.email.message}</span>
            )}
          </div>

          {!compact && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="useCase">Your Project or Use Case</Label>
              <Select onValueChange={setUseCaseValue} defaultValue={useCaseValue ?? ""}>
                <SelectTrigger id="useCase">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="startup">Startup / App</SelectItem>
                  <SelectItem value="saas">SaaS / Platform</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                  <SelectItem value="research">Research</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {compact ? (
            <Button type="submit" variant="default" size="lg" disabled={isSubmitting} className="w-full text-base font-semibold">
              {submitted ? "Joined!" : "Get Free Credits"}
            </Button>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3">
              <Button type="submit" variant="default" disabled={isSubmitting} className="w-full">
                {submitted ? "Joined!" : "Launch Today With Free Credits"}
              </Button>
              <Button type="button" variant="outline" asChild className="w-full sm:w-auto whitespace-nowrap">
                <a href="https://beta.gatewayz.ai" target="_blank" rel="noopener noreferrer">
                  Try Beta
                </a>
              </Button>
              <Button type="button" variant="outline" asChild className="w-full sm:w-auto whitespace-nowrap">
                <a href="https://cal.com/vonalytics/gatewayz" target="_blank" rel="noopener noreferrer">
                  Book a Call
                </a>
              </Button>
            </div>
          )}
        </div>
        {compact && (
          <p className="mt-3 text-sm text-gray-500 text-center">No credit card required • Instant access</p>
        )}
      </form>

      <SuccessPopup 
        open={showSuccessPopup} 
        onOpenChange={setShowSuccessPopup}
        userEmail={userEmail}
      />
    </>
  );
}
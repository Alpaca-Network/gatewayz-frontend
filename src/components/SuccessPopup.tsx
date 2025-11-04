import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CheckCircle, Calendar } from "lucide-react";
import { useState } from "react";
// import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface SuccessPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail: string;
}

const SuccessPopup = ({ open, onOpenChange, userEmail }: SuccessPopupProps) => {
  const [referralSource, setReferralSource] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);

  const handleReferralSubmit = async () => {
    if (!referralSource) {
      toast({
        title: "Please select an option",
        description: "How did you learn about us?",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Update the user's record with referral source
      // TODO: Re-enable when supabase integration is configured
      // const { error } = await supabase.functions.invoke('update-referral-source', {
      //   body: {
      //     email: userEmail,
      //     referralSource: referralSource,
      //   }
      // });
      const error = null; // Placeholder until supabase is configured

      if (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error("Error updating referral source:", error);
        }
        toast({
          title: "Something went wrong",
          description: "But don't worry, you're still on the waitlist!",
          variant: "destructive",
        });
      }

      setShowThankYou(true);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error("Unexpected error:", error);
      }
      toast({
        title: "Something went wrong",
        description: "But don't worry, you're still on the waitlist!",
        variant: "destructive",
      });
      setShowThankYou(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setShowThankYou(false);
    setReferralSource("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md border-gray-200 bg-white">
        <DialogHeader className="text-center space-y-4">
          <div className="mx-auto">
            <CheckCircle className="w-20 h-20 text-indigo-600 mx-auto animate-scale-in" />
          </div>
          <DialogTitle className="text-3xl font-bold text-center text-gray-900">
            You're on the list!
          </DialogTitle>
          <p className="text-base text-gray-600">
            Welcome to the Gatewayz beta waitlist. We'll notify you as soon as beta spots open.
          </p>
        </DialogHeader>
        
        <div className="text-center space-y-6 pt-2">

          {!showThankYou ? (
            <>
              <div className="p-6 border border-gray-200 bg-white rounded-lg text-left">
                <Label className="text-base font-semibold mb-4 block text-center text-gray-900">How did you learn about us? *</Label>
                <RadioGroup
                  value={referralSource}
                  onValueChange={setReferralSource}
                  className="grid grid-cols-2 gap-3"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="ads" id="ads" />
                    <Label htmlFor="ads" className="text-sm text-gray-700">Ads</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="linkedin" id="linkedin" />
                    <Label htmlFor="linkedin" className="text-sm text-gray-700">LinkedIn</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="x" id="x" />
                    <Label htmlFor="x" className="text-sm text-gray-700">X (Twitter)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="referral" id="referral" />
                    <Label htmlFor="referral" className="text-sm text-gray-700">Referral</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="email" id="email-option" />
                    <Label htmlFor="email-option" className="text-sm text-gray-700">Email</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="other" id="other" />
                    <Label htmlFor="other" className="text-sm text-gray-700">Other</Label>
                  </div>
                </RadioGroup>
              </div>

              <Button 
                onClick={handleReferralSubmit}
                disabled={isSubmitting}
                className="w-full bg-indigo-600 hover:bg-indigo-700"
                size="lg"
              >
                {isSubmitting ? "Saving..." : "Continue"}
              </Button>
            </>
          ) : (
            <>
              <div className="p-6 border border-gray-200 bg-indigo-50 rounded-lg">
                <p className="font-semibold mb-3 text-lg text-center text-gray-900">🎁 Get Free Credits + Priority Access</p>
                <p className="text-sm text-gray-600 text-center">
                  Book a 15-minute call with our founder Vaughn to get bonus credits and potentially run a pilot program.
                </p>
              </div>
              
              <div className="space-y-3">
                <Button asChild size="lg" className="w-full bg-indigo-600 hover:bg-indigo-700">
                  <a 
                    href="https://cal.com/vonalytics/welcome" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    <Calendar className="w-4 h-4" />
                    Book Call with Vaughn
                  </a>
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={handleClose}
                  className="w-full"
                >
                  Maybe Later
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SuccessPopup;
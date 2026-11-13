import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, DollarSign, Users, Percent, Settings2 } from "lucide-react";
import AnimatedSection from "./AnimatedSection";

const AffiliatePromoSection = () => {
  return (
    <div className="py-20 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-6xl mx-auto px-6">
        <AnimatedSection animation="fade-in">
          <div className="rounded-3xl border-2 border-[#6043ef]/20 bg-gradient-to-br from-[#6043ef]/8 via-white to-white p-8 md:p-12 shadow-[0_8px_40px_-12px_rgba(96,67,239,0.25)]">
            <div className="text-center mb-10">
              <Badge variant="secondary" className="mb-4 bg-[#6043ef]/10 text-[#6043ef] border-[#6043ef]/20">
                Affiliate Program
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
                Earn <span className="text-[#6043ef]">30%</span> on Tier 1 and <span className="text-[#6043ef]">10%</span> on Tier 2
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Recurring commissions on everyone you refer — plus a second tier on everyone they refer. Free to join.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
              <div className="bg-white rounded-2xl p-6 border border-gray-200">
                <DollarSign className="w-6 h-6 text-[#6043ef] mb-3" />
                <h3 className="font-semibold text-gray-900 mb-1">30% Tier 1</h3>
                <p className="text-sm text-gray-600">
                  Recurring commission on every customer you personally refer, for as long as they stay.
                </p>
              </div>
              <div className="bg-white rounded-2xl p-6 border border-gray-200">
                <Users className="w-6 h-6 text-[#6043ef] mb-3" />
                <h3 className="font-semibold text-gray-900 mb-1">10% Tier 2</h3>
                <p className="text-sm text-gray-600">
                  Earn a second layer of recurring commission on every customer your affiliates refer.
                </p>
              </div>
              <div className="bg-white rounded-2xl p-6 border border-gray-200">
                <Percent className="w-6 h-6 text-[#6043ef] mb-3" />
                <h3 className="font-semibold text-gray-900 mb-1">Optional Multi-Customer Discount</h3>
                <p className="text-sm text-gray-600">
                  Bringing several customers at once? Pass along a discount to them instead of keeping the full commission.
                </p>
              </div>
              <div className="bg-white rounded-2xl p-6 border border-gray-200">
                <Settings2 className="w-6 h-6 text-[#6043ef] mb-3" />
                <h3 className="font-semibold text-gray-900 mb-1">Commission + Discount Combo</h3>
                <p className="text-sm text-gray-600">
                  Split it however you want — keep commission, give a discount, or blend both. Completely customizable.
                </p>
              </div>
            </div>

            <div className="text-center">
              <Button
                size="lg"
                className="bg-[#6043ef] hover:bg-[#5a3dd8] text-white text-lg px-8 py-6 rounded-xl"
                asChild
              >
                <a href="/affiliate">
                  Become an Affiliate
                  <ArrowRight className="w-5 h-5 ml-2" />
                </a>
              </Button>
              <p className="text-sm text-gray-500 mt-4">
                Free to join · Payouts on the 1st and 15th · Two-tier recurring commissions
              </p>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </div>
  );
};

export default AffiliatePromoSection;

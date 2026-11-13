import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gift, Users, TrendingUp, Star, ArrowRight } from "lucide-react";

const AffiliateHighlight = () => {
  return (
    <div className="py-16 bg-gradient-to-br from-green-50 to-emerald-50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12 animate-fade-in">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Join Our Affiliate Program
          </h2>
          <p className="text-xl text-gray-600">
            Earn commissions while helping others discover the power of SaaSSuite
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 mb-12">
          {/* Commission Structure */}
          <Card className="text-center hover:shadow-xl transition-all duration-300 animate-fade-in">
            <CardHeader>
              <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
                <TrendingUp className="w-8 h-8 text-green-600" />
              </div>
              <CardTitle className="text-xl text-gray-900">Generous Commissions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600 mb-2">30%</div>
              <p className="text-gray-600">
                Earn 30% commission on every successful referral. Higher rates available for top performers.
              </p>
            </CardContent>
          </Card>

          {/* Support & Resources */}
          <Card className="text-center hover:shadow-xl transition-all duration-300 animate-fade-in">
            <CardHeader>
              <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-blue-600" />
              </div>
              <CardTitle className="text-xl text-gray-900">Full Support</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600 mb-2">24/7</div>
              <p className="text-gray-600">
                Complete marketing materials, dedicated support, and proven conversion strategies.
              </p>
            </CardContent>
          </Card>

          {/* Easy Setup */}
          <Card className="text-center hover:shadow-xl transition-all duration-300 animate-fade-in">
            <CardHeader>
              <div className="w-16 h-16 mx-auto bg-purple-100 rounded-full flex items-center justify-center mb-4">
                <Star className="w-8 h-8 text-purple-600" />
              </div>
              <CardTitle className="text-xl text-gray-900">Quick Setup</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600 mb-2">5min</div>
              <p className="text-gray-600">
                Get approved and start earning in minutes. No complex requirements or lengthy processes.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Benefits List */}
        <Card className="mb-12 overflow-hidden">
          <CardContent className="p-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-6">Why Partner With Us?</h3>
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <Gift className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700">Recurring monthly commissions</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Gift className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700">High-converting landing pages</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Gift className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700">Real-time tracking dashboard</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Gift className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700">Marketing assets & email templates</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-6">Perfect For:</h3>
                <div className="space-y-3">
                  <Badge variant="secondary" className="mr-2 mb-2">HighLevel Agencies</Badge>
                  <Badge variant="secondary" className="mr-2 mb-2">Marketing Consultants</Badge>
                  <Badge variant="secondary" className="mr-2 mb-2">SaaS Enthusiasts</Badge>
                  <Badge variant="secondary" className="mr-2 mb-2">Content Creators</Badge>
                  <Badge variant="secondary" className="mr-2 mb-2">Business Coaches</Badge>
                  <Badge variant="secondary" className="mr-2 mb-2">Tech Influencers</Badge>
                </div>
                <div className="mt-6">
                  <p className="text-gray-600 text-sm">
                    Whether you have 100 or 100,000 followers, our program scales with your audience.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CTA Section */}
        <div className="text-center bg-white rounded-2xl p-8 shadow-lg">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            Ready to Start Earning?
          </h3>
          <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
            Join hundreds of successful affiliates who are already earning with SaaSSuite. 
            Apply today and start generating income from your network.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg"
              className="bg-green-600 hover:bg-green-700 text-white"
              asChild
            >
              <a href="/affiliate">
                Apply Now
                <ArrowRight className="w-5 h-5 ml-2" />
              </a>
            </Button>
            <Button 
              size="lg"
              variant="outline"
              onClick={() => window.open('https://saassuite.ai/book', '_blank')}
            >
              Learn More
            </Button>
          </div>
          
          <div className="mt-4 text-sm text-gray-500">
            * No application fees • Quick approval process • Start earning immediately
          </div>
        </div>
      </div>
    </div>
  );
};

export default AffiliateHighlight;
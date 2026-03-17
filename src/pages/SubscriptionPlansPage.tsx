import { useState } from 'react';
import { useSubscriptionPlansQuery, useAssignPlan } from '@/hooks/useSubscriptions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function SubscriptionPlansPage() {
  const { data: plans = [], isLoading } = useSubscriptionPlansQuery();
  const assignPlanMutation = useAssignPlan();
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);

  const handleSelectPlan = (planId: number) => {
    if (window.confirm('Are you sure you want to select this plan?')) {
      setSelectedPlanId(planId);
      assignPlanMutation.mutate({ subscriptionId: planId });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg">Loading plans...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 bg-page-bg">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2">Choose Your Subscription Plan</h1>
          <p className="text-muted-foreground">Select a plan to get started</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className="hover:-translate-y-1 transition-transform duration-200 cursor-pointer"
            >
              <CardHeader>
                <CardTitle className="text-lg sm:text-xl lg:text-2xl">{plan.subscriptionName}</CardTitle>
                <CardDescription>
                  <span className="text-2xl sm:text-3xl font-bold text-primary">${plan.price}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Seats:</span>
                    <span className="font-medium">{plan.seats}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Validity:</span>
                    <span className="font-medium">{plan.validityDays} days</span>
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={assignPlanMutation.isPending && selectedPlanId === plan.id}
                >
                  {assignPlanMutation.isPending && selectedPlanId === plan.id
                    ? 'Selecting...'
                    : 'Select Plan'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

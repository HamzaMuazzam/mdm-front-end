import { useState } from 'react';
import { useUserPlansQuery, useChangePlan } from '@/hooks/useSubscriptions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check } from 'lucide-react';
import { usePermissionStore } from '@/store/permissionStore';

export function SubscriptionsManagement() {
  const { data: plans = [], isLoading } = useUserPlansQuery();
  const changePlanMutation = useChangePlan();
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const hasPermission = usePermissionStore((state) => state.hasPermission);

  const handleChangePlan = (planId: number) => {
    if (window.confirm('Are you sure you want to change to this plan?')) {
      setSelectedPlanId(planId);
      changePlanMutation.mutate({ subscriptionId: planId });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-lg">Loading plans...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">Subscription Plans</h2>
        <p className="text-muted-foreground">Manage your subscription plan</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <Card
            key={plan.id}
            className={`hover:-translate-y-1 transition-transform duration-200 ${
              plan.isUserPlan ? 'ring-2 ring-primary' : ''
            }`}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl">{plan.subscriptionName}</CardTitle>
                {plan.isUserPlan && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-primary text-primary-foreground">
                    <Check className="h-3 w-3" />
                    Current Plan
                  </span>
                )}
              </div>
              <CardDescription>
                <span className="text-3xl font-bold text-primary">
                  {plan.currency === 'Dollar' ? '$' : plan.currency}
                  {plan.price}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{plan.description}</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type:</span>
                  <span className="font-medium">{plan.type}</span>
                </div>
                {/*<div className="flex justify-between">*/}
                {/*  <span className="text-muted-foreground">Seats:</span>*/}
                {/*  <span className="font-medium">{plan.seats}</span>*/}
                {/*</div>*/}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Validity:</span>
                  <span className="font-medium">{plan.validityDays} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Devices:</span>
                  <span className="font-medium">{plan.noOfDevices}</span>
                </div>
              </div>
              {plan.isUserPlan ? (
                <Button className="w-full" variant="outline" disabled>
                  Current Plan
                </Button>
              ) : hasPermission('subscriptions:update') ? (
                <Button
                  className="w-full"
                  onClick={() => handleChangePlan(plan.id)}
                  disabled={changePlanMutation.isPending && selectedPlanId === plan.id}
                >
                  {changePlanMutation.isPending && selectedPlanId === plan.id
                    ? 'Changing...'
                    : 'Change Plan'}
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

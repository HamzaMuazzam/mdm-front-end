import { useState } from 'react';
import { useUserPlansQuery, useChangePlan, useCreateSubscriptionPlan } from '@/hooks/useSubscriptions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Plus, X } from 'lucide-react';
import { usePermissionStore } from '@/store/permissionStore';
import type { CreateSubscriptionRequest } from '@/types/subscription.types';

const EMPTY_FORM: CreateSubscriptionRequest = {
  subscriptionName: '',
  description: '',
  type: '',
  seats: 1,
  noOfDevices: 1,
  validityDays: 30,
  price: 0,
  currency: '',
  isCustomPlan: false,
};

export function SubscriptionsManagement() {
  const { data: plans = [], isLoading } = useUserPlansQuery();
  const changePlanMutation = useChangePlan();
  const createPlanMutation = useCreateSubscriptionPlan();
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateSubscriptionRequest>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const hasPermission = usePermissionStore((state) => state.hasPermission);

  const handleChangePlan = (planId: number) => {
    if (window.confirm('Are you sure you want to change to this plan?')) {
      setSelectedPlanId(planId);
      changePlanMutation.mutate({ subscriptionId: planId });
    }
  };

  const handleFieldChange = (field: keyof CreateSubscriptionRequest, value: string | number | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateSubmit = async () => {
    if (!form.subscriptionName.trim()) { setFormError('Plan name is required.'); return; }
    if (!form.type.trim()) { setFormError('Type is required.'); return; }
    if (!form.currency.trim()) { setFormError('Currency is required.'); return; }
    if (form.price < 0) { setFormError('Price must be 0 or greater.'); return; }
    if (form.seats < 1) { setFormError('Seats must be at least 1.'); return; }
    if (form.noOfDevices < 1) { setFormError('Number of devices must be at least 1.'); return; }
    if (form.validityDays < 1) { setFormError('Validity must be at least 1 day.'); return; }
    setFormError('');
    try {
      await createPlanMutation.mutateAsync(form);
      setIsCreateOpen(false);
      setForm(EMPTY_FORM);
    } catch {
      // handled by mutation toast
    }
  };

  const handleCloseCreate = () => {
    if (createPlanMutation.isPending) return;
    setIsCreateOpen(false);
    setForm(EMPTY_FORM);
    setFormError('');
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold mb-1">Subscription Plans</h2>
          <p className="text-muted-foreground">Manage your subscription plan</p>
        </div>
        {hasPermission('subscriptions:create') && (
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Plan
          </Button>
        )}
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

      {/* Create Plan Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg m-4 max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Create Subscription Plan</CardTitle>
              <button type="button" onClick={handleCloseCreate} className="opacity-70 hover:opacity-100">
                <X className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sp-name">Plan Name</Label>
                  <Input
                    id="sp-name"
                    value={form.subscriptionName}
                    onChange={(e) => handleFieldChange('subscriptionName', e.target.value)}
                    placeholder="e.g. Professional"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sp-description">Description</Label>
                  <Input
                    id="sp-description"
                    value={form.description}
                    onChange={(e) => handleFieldChange('description', e.target.value)}
                    placeholder="Optional description"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sp-type">Type</Label>
                  <Input
                    id="sp-type"
                    value={form.type}
                    onChange={(e) => handleFieldChange('type', e.target.value)}
                    placeholder="e.g. Monthly, Annual"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sp-price">Price</Label>
                    <Input
                      id="sp-price"
                      type="number"
                      min={0}
                      step={0.01}
                      value={form.price}
                      onChange={(e) => handleFieldChange('price', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sp-currency">Currency</Label>
                    <Input
                      id="sp-currency"
                      value={form.currency}
                      onChange={(e) => handleFieldChange('currency', e.target.value)}
                      placeholder="e.g. USD, Dollar"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sp-seats">Seats</Label>
                    <Input
                      id="sp-seats"
                      type="number"
                      min={1}
                      value={form.seats}
                      onChange={(e) => handleFieldChange('seats', parseInt(e.target.value) || 1)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sp-devices">No. of Devices</Label>
                    <Input
                      id="sp-devices"
                      type="number"
                      min={1}
                      value={form.noOfDevices}
                      onChange={(e) => handleFieldChange('noOfDevices', parseInt(e.target.value) || 1)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sp-validity">Validity (days)</Label>
                    <Input
                      id="sp-validity"
                      type="number"
                      min={1}
                      value={form.validityDays}
                      onChange={(e) => handleFieldChange('validityDays', parseInt(e.target.value) || 1)}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-md border px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">Custom Plan</p>
                    <p className="text-xs text-muted-foreground">Mark this as a custom / bespoke plan</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isCustomPlan}
                      onChange={(e) => handleFieldChange('isCustomPlan', e.target.checked as any)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
                  </label>
                </div>

                {formError && <p className="text-sm text-destructive">{formError}</p>}

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={handleCloseCreate} disabled={createPlanMutation.isPending}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={handleCreateSubmit} disabled={createPlanMutation.isPending}>
                    {createPlanMutation.isPending ? 'Creating...' : 'Create Plan'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

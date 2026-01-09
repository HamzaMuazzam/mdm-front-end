export interface Subscription {
  id: number;
  subscriptionName: string;
  seats: number;
  validity: number;
  price: number;
}

export interface UserSubscriptionPlan {
  id: number;
  userId: number;
  subscriptionId: number;
  startDate: string;
  endDate: string;
  status: string;
  subscription?: Subscription;
}

export interface AssignPlanRequest {
  subscriptionId: number;
}

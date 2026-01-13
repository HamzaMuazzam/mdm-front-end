export interface Subscription {
  id: number;
  subscriptionName: string;
  seats: number;
  validity: number;
  price: number;
}

export interface UserPlanSubscription {
  id: number;
  subscriptionName: string;
  description: string;
  type: string;
  seats: number;
  validityDays: number;
  noOfDevices: number;
  price: number;
  isUserPlan: boolean;
  currency: string;
  createdAt: string;
  updatedAt: string | null;
  deletedAt: string | null;
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

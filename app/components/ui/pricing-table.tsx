import { Check } from 'lucide-react';
import { Button } from './button';
import { formatCurrency } from '@/lib/utils';

interface PricingPlan {
  name: string;
  price: number;
  period: string;
  description: string;
  features: string[];
  popular?: boolean;
  cta: {
    text: string;
    href: string;
  };
}

interface PricingTableProps {
  plans: PricingPlan[];
}

export function PricingTable({ plans }: PricingTableProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
      {plans.map((plan, index) => (
        <div
          key={index}
          className={`relative bg-white rounded-xl border-2 p-8 ${
            plan.popular
              ? 'border-blue-500 shadow-xl scale-105'
              : 'border-gray-200 shadow-lg'
          }`}
        >
          {plan.popular && (
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
              <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                Populaire
              </span>
            </div>
          )}

          <div className="text-center">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              {plan.name}
            </h3>
            <div className="mb-4">
              <span className="text-4xl font-bold text-gray-900">
                {formatCurrency(plan.price / 100)}
              </span>
              <span className="text-gray-500">/{plan.period}</span>
            </div>
            <p className="text-gray-600 mb-6">
              {plan.description}
            </p>
          </div>

          <ul className="space-y-3 mb-8">
            {plan.features.map((feature, featureIndex) => (
              <li key={featureIndex} className="flex items-start">
                <Check className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">{feature}</span>
              </li>
            ))}
          </ul>

          <div className="text-center">
            <a href={plan.cta.href}>
              <Button
                className={`w-full ${
                  plan.popular
                    ? 'bg-blue-500 hover:bg-blue-600'
                    : 'bg-gray-900 hover:bg-gray-800'
                }`}
                size="lg"
              >
                {plan.cta.text}
              </Button>
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
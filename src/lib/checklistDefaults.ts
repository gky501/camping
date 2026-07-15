import type { ChecklistTemplate } from '../types';

export const DEFAULT_CHECKLIST_TEMPLATE: ChecklistTemplate = {
  sections: [
    {
      id: 'section-towing',
      name: 'Hitch & towing',
      items: [
        { id: 'item-hitch', label: 'Hitch and weight-distribution bars' },
        { id: 'item-sway', label: 'Sway control connected' },
        { id: 'item-chains', label: 'Safety chains crossed and secured' },
        { id: 'item-breakaway', label: 'Breakaway cable connected' },
        { id: 'item-lights', label: 'Trailer lights and brakes checked' },
        { id: 'item-tires', label: 'Truck and trailer tire pressures checked' },
        { id: 'item-mirrors', label: 'Tow mirrors adjusted' },
      ],
    },
    {
      id: 'section-setup',
      name: 'Campsite setup',
      items: [
        { id: 'item-leveling', label: 'Leveling blocks and wheel chocks' },
        { id: 'item-surge', label: 'Surge protector / EMS' },
        { id: 'item-water-hose', label: 'Fresh-water hose and pressure regulator' },
        { id: 'item-sewer', label: 'Sewer hose, supports, and fittings' },
        { id: 'item-power', label: 'Power cord and adapters' },
        { id: 'item-tools', label: 'Basic tool kit' },
        { id: 'item-chairs', label: 'Camp chairs and outdoor mat' },
      ],
    },
    {
      id: 'section-kitchen',
      name: 'Kitchen & food',
      items: [
        { id: 'item-meals', label: 'Meals and snacks' },
        { id: 'item-drinks', label: 'Drinks and drinking water' },
        { id: 'item-coffee', label: 'Coffee supplies' },
        { id: 'item-cookware', label: 'Cookware and utensils' },
        { id: 'item-paper', label: 'Paper towels and trash bags' },
        { id: 'item-grill', label: 'Grill / griddle supplies' },
      ],
    },
    {
      id: 'section-personal',
      name: 'Clothing & personal',
      items: [
        { id: 'item-clothes', label: 'Weather-appropriate clothing' },
        { id: 'item-shoes', label: 'Shoes / boots' },
        { id: 'item-toiletries', label: 'Toiletries and medications' },
        { id: 'item-towels', label: 'Towels and washcloths' },
        { id: 'item-bedding', label: 'Bedding and pillows' },
        { id: 'item-rain', label: 'Rain gear' },
      ],
    },
    {
      id: 'section-pets',
      name: 'Pets',
      items: [
        { id: 'item-pet-food', label: 'Food, treats, and bowls' },
        { id: 'item-pet-leads', label: 'Leashes, harnesses, and campsite leads' },
        { id: 'item-pet-bags', label: 'Waste bags' },
        { id: 'item-pet-bedding', label: 'Pet beds / blankets' },
        { id: 'item-pet-meds', label: 'Pet medications and records' },
      ],
    },
    {
      id: 'section-documents',
      name: 'Documents & electronics',
      items: [
        { id: 'item-reservation', label: 'Reservation confirmation and gate code' },
        { id: 'item-wallet', label: 'Wallet, IDs, and insurance cards' },
        { id: 'item-chargers', label: 'Phone and device chargers' },
        { id: 'item-hotspot', label: 'Hotspot / connectivity gear' },
        { id: 'item-camera', label: 'Camera and memory cards' },
      ],
    },
    {
      id: 'section-departure',
      name: 'Before pulling out',
      items: [
        { id: 'item-doors', label: 'Doors, drawers, and refrigerator secured' },
        { id: 'item-antenna', label: 'Antenna and vents lowered / closed' },
        { id: 'item-awning', label: 'Awning fully retracted' },
        { id: 'item-slide', label: 'Slide fully retracted' },
        { id: 'item-jacks', label: 'Stabilizers and tongue jack raised' },
        { id: 'item-walkaround', label: 'Final walk-around complete' },
      ],
    },
  ],
};

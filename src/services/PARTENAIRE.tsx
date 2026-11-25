import { PackageItem } from '../types';

export interface PartnerApiConfig {
  endpointUrl: string;
  apiKey: string;
  partnerName: string;
}

export const sendPackageToPartnerAPI = async (
  pkg: PackageItem,
  config: PartnerApiConfig
): Promise<{ success: boolean; partnerTrackingId?: string; error?: string }> => {
  try {
    // تنسيق البيانات التي يطلبها عادة نظام الشريك
    const payload = {
      order_id: pkg.trackingNumber,
      customer_name: pkg.recipientName,
      customer_phone: pkg.recipientPhone,
      city: pkg.city,
      address: pkg.address,
      cash_on_delivery: pkg.codAmount,
      delivery_cost: pkg.deliveryFee,
      items_description: pkg.description || 'Colis e-commerce',
      notes: pkg.notes || ''
    };

    const response = await fetch(config.endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'apikey': config.apiKey
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: `Erreur API Partenaire (${response.status}): ${errText}` };
    }

    const data = await response.json();
    
    // استخراج رقم التتبع الممنوح من الشريك (حسب بنية جوابه)
    const partnerTrackingId = data.tracking_id || data.trackingNumber || data.id || `PARTNER-${Date.now()}`;

    return {
      success: true,
      partnerTrackingId: String(partnerTrackingId)
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Impossible de contacter le serveur du partenaire'
    };
  }
};
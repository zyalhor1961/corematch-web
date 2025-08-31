// Configuration OpenAI pour le chatbot public
export class PublicChatAPI {
  private static readonly API_URL = '/api/public-chat';

  static async sendMessage(message: string): Promise<string> {
    try {
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        throw new Error('Erreur réseau');
      }

      const data = await response.json();
      return data.response;
    } catch (error) {
      console.error('Erreur chat:', error);
      return "Désolé, je rencontre un problème technique. Essayez de recharger la page ou contactez notre support.";
    }
  }

  // Réponses de démonstration sans API (fallback)
  static getDemoResponse(message: string): string {
    const msg = message.toLowerCase();
    
    if (msg.includes('prix') || msg.includes('tarif') || msg.includes('coût')) {
      return "Nos tarifs CoreMatch : \n• Starter : 29€/mois (50 analyses CV)\n• Pro : 99€/mois (500 analyses CV)\n• Enterprise : 299€/mois (illimité)\n\nEssai gratuit 14 jours sans engagement ! Voulez-vous que je vous montre une démo ?";
    }
    
    if (msg.includes('démo') || msg.includes('demo') || msg.includes('essayer')) {
      return "Je peux vous faire une démonstration en direct ! CoreMatch analyse automatiquement les CV avec l'IA et identifie les meilleurs candidats. Souhaitez-vous programmer un appel avec notre équipe ?";
    }
    
    if (msg.includes('fonctionnalité') || msg.includes('feature')) {
      return "CoreMatch inclut :\n• 🤖 Analyse IA des CV automatique\n• ⭐ Scoring intelligent des candidats\n• 💬 Chat IA pour questions RH\n• 📊 Analytics et rapports\n• 🔗 Intégrations ATS\n\nQue souhaitez-vous découvrir en détail ?";
    }

    if (msg.includes('contact') || msg.includes('rdv') || msg.includes('appel')) {
      return "Parfait ! Vous pouvez :\n• 📧 Email : contact@corematch.fr\n• 📞 Téléphone : +33 1 23 45 67 89\n• 📅 Réserver une démo : calendly.com/corematch\n\nOu laissez-moi vos coordonnées et on vous rappelle !";
    }
    
    return "Bonjour ! Je suis l'assistant IA de CoreMatch. Je peux vous expliquer comment notre plateforme révolutionne le recrutement avec l'intelligence artificielle. Que souhaitez-vous savoir sur nos solutions de sélection de candidats ?";
  }
}
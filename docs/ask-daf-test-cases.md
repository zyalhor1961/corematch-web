# Ask DAF - Test Cases Manual

Ce document contient les cas de test pour valider le comportement de Ask DAF.

## Test Cases

### 1. Questions Business Valides

| Question | Comportement Attendu |
|----------|---------------------|
| "Donne moi les factures non réglées" | Appel `list_invoices(status='unpaid')`, liste des factures avec montants |
| "Combien j'ai dépensé en 2024 ?" | Appel `sum_invoices(dateFrom='2024-01-01', dateTo='2024-12-31')`, total en euros |
| "Quels sont mes principaux fournisseurs ?" | Appel `invoices_by_supplier()`, liste triée par montant |
| "Liste les CVs reçus ce mois-ci" | Appel `list_cvs(dateFrom=début du mois)`, liste de candidats |
| "Résumé de mon workspace" | Appel `get_overview_stats()`, statistiques générales |
| "Documents reçus hier" | Appel `list_documents(dateFrom=hier, dateTo=hier)` |
| "Combien j'ai dépensé chez EDF ?" | Appel `sum_invoices(supplier='EDF')` |
| "Évolution de mes dépenses par mois" | Appel `invoices_by_month()`, données chartables |

### 2. Questions Hors Scope (DOIVENT être rejetées)

| Question | Comportement Attendu |
|----------|---------------------|
| "Comment faire des pâtes à la française ?" | Message: "Je suis Ask DAF, l'assistant financier..." |
| "Quel temps fait-il aujourd'hui ?" | Message: "Je suis Ask DAF, l'assistant financier..." |
| "Raconte-moi une blague" | Message: "Je suis Ask DAF, l'assistant financier..." |
| "Quels films sont sortis cette semaine ?" | Message: "Je suis Ask DAF, l'assistant financier..." |
| "Donne moi une recette de gâteau au chocolat" | Message: "Je suis Ask DAF, l'assistant financier..." |

### 3. Questions Sans Données

| Question | Comportement Attendu |
|----------|---------------------|
| "Factures de Microsoft" (si aucune) | "Je n'ai trouvé aucune facture de Microsoft dans vos données Corematch." |
| "CVs développeur Rust" (si aucun) | "Je n'ai trouvé aucun CV mentionnant Rust." |

### 4. Validation Anti-Hallucination

| Scénario | Vérification |
|----------|-------------|
| Réponse avec montants | Les montants doivent correspondre aux données des tools |
| Réponse sans données | Aucun montant inventé, message clair "pas de données" |
| Tools appelés | Au moins un tool doit être appelé pour chaque question business |

## Comment Tester

1. Aller sur `/org/[orgId]/daf` et cliquer sur l'onglet "Ask DAF"
2. Poser chaque question du tableau
3. Vérifier le comportement dans la console Vercel (logs)
4. Vérifier la réponse affichée

## Logs à Vérifier

```
[Ask DAF] Out-of-scope question detected: "..."  // Pour questions hors scope
[Ask DAF] Tool call: list_invoices {...}         // Appel de tool
[Ask DAF] Response generated in Xms, tools: ..., rows: Y
```

## Indicateurs de Succès

- [ ] Questions business : Toujours au moins 1 tool appelé
- [ ] Questions hors scope : Rejet immédiat sans appel LLM
- [ ] Pas de données : Message clair, pas de chiffres inventés
- [ ] Warnings affichés si comportement suspect

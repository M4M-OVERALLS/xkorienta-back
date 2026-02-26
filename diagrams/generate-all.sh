#!/bin/bash

# Script pour générer tous les diagrammes PlantUML
# Usage: ./generate-all.sh [format]
# Format: png (défaut), pdf, svg

FORMAT=${1:-png}

echo "🎨 Génération des diagrammes PlantUML en format $FORMAT..."
echo ""

# Vérifier si PlantUML est installé
if ! command -v plantuml &> /dev/null; then
    echo "❌ PlantUML n'est pas installé."
    echo "   Installation: HOMEBREW_NO_AUTO_UPDATE=1 brew install plantuml"
    exit 1
fi

# Compter les fichiers
COUNT=$(ls -1 *.puml 2>/dev/null | wc -l | tr -d ' ')

if [ "$COUNT" -eq 0 ]; then
    echo "❌ Aucun fichier .puml trouvé dans le dossier actuel"
    exit 1
fi

echo "📊 $COUNT fichiers trouvés"
echo ""

# Générer les diagrammes
for file in *.puml; do
    echo "   Génération de $file..."
    plantuml -t$FORMAT "$file"
done

echo ""
echo "✅ Génération terminée !"
echo "   Format: $FORMAT"
echo "   Dossier: $(pwd)"
echo ""

# Lister les fichiers générés
echo "📁 Fichiers générés:"
ls -lh *.$FORMAT 2>/dev/null || echo "   Aucun fichier trouvé"

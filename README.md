# Sync Balls Racing

Jogue em https://ericmgomes.github.io/sync-balls-racing/.

O workflow `.github/workflows/deploy.yml` executa os testes, gera o build e publica no GitHub Pages a cada push na branch `main`.

Puzzle de sincronia em Vite + TypeScript + Three.js (WebGL 2), sem framework UI, backend ou banco de dados.

Todas as bolas têm o mesmo acabamento metálico prateado, sem números; as cores identificam as pistas. As pistas ficam agrupadas e têm dois trechos de subida entre descidas. A altura participa tanto do desenho quanto da física; o comprimento considera as três dimensões. O gerador valida a passagem levando em conta as perdas de energia.

O tabuleiro é um modelo 3D com canaletas abertas, trechos ortogonais, cantos arredondados, paredes chanfradas e suportes vazados. Materiais de plástico com textura procedural, esferas cromadas, reflexos capturados da cena e sombras projetadas aproximam a aparência do brinquedo físico. Arraste para girar, use a roda do mouse ou pinça para aproximar e clique em **Restaurar vista** para voltar. Os alvos de clique acompanham a câmera. Exige WebGL 2; todos os modelos e texturas são gerados localmente, sem carregar assets externos.

## Executar

```sh
npm install
npm run dev
```

`npm test` executa os testes. `npm run build` verifica os tipos e gera `dist/`. `npm run preview` serve o build. O projeto usa `base: './'` para deploy estático, inclusive em subpastas do GitHub Pages. Na Vercel, use preset Vite, build `npm run build` e saída `dist`.

## Regras

Solte as seis bolas com as teclas 1–6 ou clicando/tocando nelas. Todas saem do repouso e obedecem à mesma gravidade. Somente a geometria da pista muda o movimento e o tempo de descida.

A faixa listrada fica antes da linha de chegada e começa aberta. A primeira bola a chegar aciona seu fechamento. Bolas que chegam juntas, dentro da tolerância de **30 ms**, passam. Caso contrário, a prova termina em falha: as atrasadas continuam descendo até encostar na faixa, onde ficam retidas sem concluir. Se uma bola já entrou na faixa quando ela fecha, fica retida ali, sem recuar. As bolas não liberadas permanecem no início. Não é possível liberar novas bolas depois da primeira chegada. O reinício reabre a faixa.

Vitórias mostram a diferença entre as chegadas e salvam o melhor resultado. Derrotas não geram um spread fictício nem registram recorde. A tabela distingue chegadas reais de bolas que não concluíram.

**Tentar novamente** mantém a pista e incrementa a tentativa. **Novo puzzle** muda a seed e atualiza a URL sem recarregar. `?puzzle=48291` reproduz o puzzle. `?puzzle=48291&debug=1` mostra tempos físicos, liberações, chegadas e atrasos ideais.

## Física

Uma unidade do mundo corresponde a 1 mm: a base mede aproximadamente 71 × 81 cm e a largada fica 18 cm acima do nível final. A gravidade é 9.810 mm/s² (9,81 m/s²), sem câmera lenta. O raio das bolas é 12 mm. A orientação das esferas acompanha a distância percorrida (ângulo = distância / raio), acumulando a rotação nas curvas. Os reflexos vêm de uma captura estática do tabuleiro, não de ray tracing em tempo real.

Referência para rolamento sem deslizamento e inércia: [OpenStax — Rolling Motion](https://openstax.org/books/university-physics-volume-1/pages/11-1-rolling-motion). Os testes comparam uma rampa sem perdas à solução analítica de uma esfera maciça e verificam a equivalência entre metros e milímetros.

As esferas metálicas rolam dentro das canaletas sob a mesma gravidade. O modelo usa a inércia de uma esfera maciça (fator 1,4), resistência ao rolamento e arrasto proporcional ao quadrado da velocidade. A força tangencial depende da inclinação real em 3D. A resistência sempre se opõe ao movimento.

A simulação avança em segmentos de até uma unidade lógica, resolve a aceleração em cada trecho e registra distância, velocidade e tempo. Se a energia se esgota numa subida, calcula o ponto de parada e deixa a bola retornar. Não aplica velocidade mínima nem impulso para vencer elevações. A renderização consulta essa trajetória pelo relógio `performance.now()`, sem depender do FPS.

O gerador simula cada pista antes de aceitá-la. Quando uma subida impede a passagem, reduz o relevo de forma determinística e simula novamente, até obter um percurso completável. Os parâmetros são iguais para todas as bolas e ficam em `src/game/config.ts`. Os tempos são consequência da pista e das perdas, nunca sorteados.

Ainda é uma aproximação de rolamento guiado: não simula deformação, quique, colisões entre bolas ou perda de contato com a canaleta. Os coeficientes são de jogo, não uma calibração de materiais reais.

A faixa e o prazo de chegada usam timestamps independentes dos frames. O resultado e o cronômetro ficam definidos no prazo de chegada; o movimento das bolas atrasadas continua somente até a faixa.
## Estrutura

- `src/main.ts`: interface, ponteiro, URL, resultados e animação.
- `src/game/Game.ts`: estados, chegada simultânea e bloqueio.
- `src/game/Physics.ts`: velocidade, duração e posição sob gravidade.
- `src/game/Track.ts`: interpolação da posição no caminho.
- `src/game/types.ts` e `config.ts`: modelos e configurações.
- `src/generation/`: RNG e geometria determinísticos.
- `src/rendering/Renderer.ts`: modelo 3D, câmera, materiais, iluminação, bolas e barreira.
- `src/input/InputManager.ts`: teclado.
- `src/storage/scores.ts`: tentativas e recordes locais.
- `src/styles/main.css`: layout responsivo.
- `tests/`: física, geração, sincronização, bloqueio e persistência.

A arquitetura prevê Easy (4 bolas), Normal (6) e Hard (8); a interface usa Normal. O armazenamento é separado por seed e dificuldade, com fallback em memória se localStorage estiver bloqueado. Cada abertura ou reinício conta uma tentativa. A versão v6 dos recordes separa as pistas 3D atuais dos resultados antigos, que permanecem intactos no armazenamento.

## Limites do MVP

Sem login, ranking online, multiplayer, backend, áudio, editor de pistas ou colisões. Próximo passo sugerido: jogar repetidamente para ajustar a tolerância e a geometria, mantendo a mesma física para todas as bolas.




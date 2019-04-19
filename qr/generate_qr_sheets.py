import sys
import qrcode
from PIL import Image, ImageColor

URL = 'cellar.casasumu.com/#u={}&p={}&b={}'

ARG_MSG = '''img width, img height, sticker width, sticker height,
left margin, right margin, top margin, bottom margin, x spacing, y spacing,
username, password, lower bottle #, upper bottle # (inclusive), dpi,
number columns, number rows
'''

# Produces images of QR code tiles.
# Command-line args:
#   img width, img height, sticker width, sticker height,
#   left margin, right margin, top margin, bottom margin,
#   sticker x spacing, sticker y spacing, username, password,
#   lower bottle #, upper bottle # (inclusive), dpi,
#   grid count x, grid count y
if __name__ == '__main__':

    args = sys.argv
    if len(args) != 18:
        print 'Needs 17 args:', ARG_MSG
        sys.exit(1)

    # Get console args
    sheetWidth, sheetHeight, stickerWidth, stickerHeight = map(float, args[1:5])
    leftMargin, rightMargin, topMargin, bottomMargin = map(float, args[5:9])
    xSpacing, ySpacing = map(float, args[9:11])
    username, password = args[11:13]
    lowerBottleNum, upperBottleNum, dpi = map(int, args[13:16])
    numCols, numRows = map(int, args[16:18])

    bottleCount = upperBottleNum - lowerBottleNum + 1
    bottlesPerSheet = numCols * numRows
    sheetCount = bottleCount / bottlesPerSheet + 1
    bottleNum = lowerBottleNum
    targetStickerWidth = int(stickerWidth * dpi)
    targetStickerHeight = int(stickerHeight * dpi)

    for sheetI in range(sheetCount):
        currSheetName = 'sheet{}'.format(sheetI)
        currSheet = Image.new(
            'RGB',
            (int(sheetWidth * dpi), int(sheetHeight * dpi)),
            color='#FFFFFF'
        )
        xOffset, yOffset = int(leftMargin * dpi), int(topMargin * dpi)

        for row in range(numRows):
            for col in range(numCols):

                if bottleNum > upperBottleNum:
                    break

                url = URL.format(username, password, bottleNum)

                qr = qrcode.QRCode(
                    version=None,
                    error_correction=qrcode.constants.ERROR_CORRECT_Q,
                    box_size=10,
                    border=4,
                )
                qr.add_data(url)
                qr.make(fit=True)

                img = qr.make_image(
                    fill_color='black',
                    back_color='white'
                )
                img.thumbnail(
                    (targetStickerWidth, targetStickerHeight), Image.NEAREST)
                currSheet.paste(img, (int(xOffset), int(yOffset)))

                xOffset += targetStickerWidth + int(xSpacing * dpi)
                bottleNum += 1
            
            xOffset = int(leftMargin * dpi)
            yOffset += targetStickerHeight + int(ySpacing * dpi)
        
        print '--> saving', '{}.jpg'.format(currSheetName)
        currSheet.save('{}.jpg'.format(currSheetName))

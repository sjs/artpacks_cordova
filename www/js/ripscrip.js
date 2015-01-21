var Ripscrip = (function () {
    "use strict";
    var display, textWindow, viewport, cursor, drawingPosition, drawColor, writeMode, fontStyle, lineStyle, useCustomFill, fillStyle, customFill, palette;
    display = new Uint8Array(640 * 350);
    textWindow = { "x0": 0, "y0": 0, "x1": 0, "y1": 0, "size": 0, "wrap": 0 };
    viewport = { "x0": 0, "y0": 0, "x1": 0, "y1": 0 };
    cursor = { "x": 0, "y": 0 };
    drawingPosition = { "x": 0, "y": 0 };
    drawColor = 0;
    writeMode = 0;
    fontStyle = { "font": 0, "direction": 0, "size": 0 };
    lineStyle = { "style": 0, "userPat": 0, "thick": 0 };
    useCustomFill = 0;
    fillStyle = { "pattern": 0, "color": 0 };
    customFill = { "pattern": new Uint8Array(8), "color": 0 };

    function egaRGB(value) {
        return new Uint8Array([
            (((value & 32) >> 5) + ((value & 4) >> 1)) * 0x55,
            (((value & 16) >> 4) + ((value & 2))) * 0x55,
            (((value & 8) >> 3) + ((value & 1) << 1)) * 0x55,
            255
        ]);
    }

    palette = [0, 1, 2, 3, 4, 5, 20, 7, 56, 57, 58, 59, 60, 61, 62, 63].map(egaRGB);

    function httpGet(url, callback) {
        var http = new XMLHttpRequest();
        http.open("GET", url, true);

        http.onreadystatechange = function () {
            if (http.readyState === 4) {
                switch (http.status) {
                case 0:
                case 200:
                    callback(new Uint8Array(http.response));
                    break;
                default:
                    throw ("Could not retrieve: " + url);
                }
            }
        };

//        http.setRequestHeader("Content-Type", "application/octet-stream");
        http.responseType = "arraybuffer";
        http.send();
    }

    function File(bytes) {
        var i;

        i = 0;

        this.get = function () {
            return bytes[i++];
        };

        this.eof = function () {
            return i === bytes.length;
        };

        this.peek = function (num) {
            return bytes[i + num];
        };

        this.read = function (num) {
            i += num;
        };

        this.getUntil = function (code, escaped) {
            var charCode, string;
            string = "";
            while (i < bytes.length) {
                charCode = bytes[i++];
                switch (charCode) {
                case code:
                    return string;
                case 13:
                    if (bytes[i] === 10) {
                        ++i;
                        return '';
                    }
                    break;
                case 92:
                    if (escaped) {
                        if (bytes[i] === 13 && bytes[i + 1] === 10) {
                            i += 2;
                        } else {
                            string += String.fromCharCode(bytes[i++]);
                        }
                    } else {
                        string += "\\";
                    }
                    break;
                default:
                    string += String.fromCharCode(charCode);
                }
            }
            return string;
        };
    }

    function parseCommand(string) {
        var i, charCode, lvl, cmd, param;
        i = 0;
        lvl = new Uint8Array(9);
        while (i < 9) {
            charCode = string.charCodeAt(i);
            if (charCode >= 48 && charCode <= 57) {
                lvl[i++] = charCode - 48;
            } else {
                break;
            }
        }
        cmd = string.charAt(i++);
        param = string.substr(i, string.length - i);
        return {
            "lvl": lvl,
            "cmd": cmd,
            "param": param
        };
    }

    function createCanvas() {
        var canvas, ctx, imageData, i, col;
        canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 350;
        ctx = canvas.getContext("2d");
        imageData = ctx.getImageData(0, 0, 640, 350);
        for (i = 0; i < display.length; ++i) {
            col = display[i];
            imageData.data.set(palette[col], i * 4);
        }
        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }

    function parseFile(file, command, literal, callback) {
        while (!file.eof()) {
            if (file.peek(0) === 33 && file.peek(1) === 124) {
                file.read(2);
                while (!file.eof()) {
                    command(parseCommand(file.getUntil(124, true)));
                    if (file.peek(-1) === 10) {
                        break;
                    }
                }
            } else {
                literal(file.getUntil());
            }
        }
        callback(createCanvas());
    }

    function parseParam(param, array) {
        var i, j, substring, value;
        value = new Uint16Array(array.length);
        for (i = j = 0; i < array.length; ++i) {
            if (j + array[i] > param.length) {
                throw "parsing error";
            }
            substring = param.substr(j, array[i]);
            j += array[i];
            if (!substring.match(/^[0-9A-Za-z]+$/)) {
                throw "parsing error";
            }
            value[i] = parseInt(substring, 36);
        }
        return {
            "value": value,
            "text": param.substr(j, param.length - j)
        };
    }

    function parseMultiParam(param) {
        var i, j, substring, value;
        if (param.length % 2 !== 0) {
            throw "parsing error";
        }
        value = new Uint16Array(param.length / 2);
        for (i = j = 0; i < value.length; ++i) {
            substring = param.substr(j, 2);
            j += 2;
            if (!substring.match(/^[0-9A-Za-z]+$/)) {
                throw "parsing error";
            }
            value[i] = parseInt(substring, 36);
        }
        return {
            "value": value,
            "text": ""
        };
    }

    function setPixel(x, y, col) {
        if (x >= 0 && y >= 0 && x <= (viewport.x1 - viewport.x0) && y <= (viewport.y1 - viewport.y0)) {
            display[(y + viewport.y0) * 640 + x + viewport.x0] = col;
        }
    }

    function line(x0, y0, x1, y1, col) {
        var dx, dy, sx, sy, err, e2;
        dx = Math.abs(x1 - x0);
        sx = (x0 < x1) ? 1 : -1;
        dy = Math.abs(y1 - y0);
        sy = (y0 < y1) ? 1 : -1;
        err = ((dx > dy) ? dx : -dy) / 2;

        while (true) {
            setPixel(x0, y0, col);
            if (x0 === x1 && y0 === y1) {
                break;
            }
            e2 = err;
            if (e2 > -dx) {
                err -= dy;
                x0 += sx;
            }
            if (e2 < dy) {
                err += dx;
                y0 += sy;
            }
        }
    }

    function polygonOutline(coord, col) {
        var i;
        for (i = 1; i < coord.length - 2; i += 2) {
            line(coord[i], coord[i + 1], coord[i + 2], coord[i + 3], col);
        }
        line(coord[i], coord[i + 1], coord[1], coord[2], col);
    }

    function filledOval(originX, originY, width, height, col) {
        var hh, ww, hhww, x0, x1, dx, x, y;
        hh = height * height;
        ww = width * width;
        hhww = hh * ww;
        x0 = width;
        dx = 0;

        for (x = -width; x <= width; x++) {
            setPixel(originX + x, originY, col);
        }

        for (y = 1; y <= height; y++) {
            for (x1 = x0 - (dx - 1); x1 > 0; x1--) {
                if (x1 * x1 * hh + y * y * ww <= hhww) {
                    break;
                }
            }
            dx = x0 - x1;
            x0 = x1;
            for (x = -x0; x <= x0; ++x) {
                setPixel(originX + x, originY - y, col);
                setPixel(originX + x, originY + y, col);
            }
        }
    }

    function textWindowEnabled() {
        return textWindow.x0 !== 0 || textWindow.y0 !== 0 || textWindow.x1 !== 0 || textWindow.y1 !== 0;
    }

    function viewportEnabled() {
        return viewport.x0 !== 0 || viewport.y0 !== 0 || viewport.x1 !== 0 || viewport.y1 !== 0;
    }

    function ripTextWindow(param) {
        textWindow.x0 = param.value[0];
        textWindow.y0 = param.value[1];
        textWindow.x1 = param.value[2];
        textWindow.y1 = param.value[3];
        textWindow.size = param.value[4];
        textWindow.wrap = param.value[5];
    }

    function ripViewport(param) {
        viewport.x0 = param.value[0];
        viewport.y0 = param.value[1];
        viewport.x1 = param.value[2];
        viewport.y1 = param.value[3];
    }

    function ripResetWindows() {
        textWindow.x0 = 0;
        textWindow.y0 = 0;
        textWindow.x1 = 79;
        textWindow.y1 = 42;
        textWindow.size = 0;
        textWindow.wrap = 1;
        viewport.x0 = 0;
        viewport.y0 = 0;
        viewport.x1 = 639;
        viewport.y1 = 349;
    }

    function ripEraseWindow() {
        if (textWindowEnabled()) {
            console.log("eraseWindow");
        }
    }

    function ripEraseView() {
        if (viewportEnabled()) {
            console.log("eraseView");
        }
    }

    function ripGotoXY(param) {
        if (textWindowEnabled()) {
            cursor.x = param.value[0];
            cursor.y = param.value[1];
        }
    }

    function ripHome() {
        if (textWindowEnabled()) {
            cursor.x = 0;
            cursor.y = 0;
        }
    }

    function ripEraseEol() {
        if (textWindowEnabled()) {
            console.log("eraseEol");
        }
    }

    function ripColor(param) {
        drawColor = param.value[0];
    }

    function ripSetPalette(param) {
        var i;
        for (i = 0; i < 16; ++i) {
            palette[i] = egaRGB(param.value[i]);
        }
    }

    function ripOnePalette(param) {
        palette[param.value[0]] = egaRGB(param.value[1]);
    }

    function ripWriteMode(param) {
        writeMode = param.value[0];
    }

    function ripMove(param) {
        drawingPosition.x = param.value[0];
        drawingPosition.y = param.value[0];
    }

    function ripText(param) {
        console.log("text", param);
    }

    function ripTextXY(param) {
        console.log("textXY", param);
    }

    function ripFontStyle(param) {
        fontStyle.font = param.value[0];
        fontStyle.direction = param.value[1];
        fontStyle.size = param.value[2];
    }

    function ripPixel(param) {
        setPixel(param.value[0], param.value[1], drawColor);
    }

    function ripLine(param) {
        line(param.value[0], param.value[1], param.value[2], param.value[3], drawColor);
    }

    function ripRectangle(param) {
        line(param.value[0], param.value[1], param.value[2], param.value[1], drawColor);
        line(param.value[2], param.value[1], param.value[2], param.value[3], drawColor);
        line(param.value[2], param.value[3], param.value[0], param.value[3], drawColor);
        line(param.value[0], param.value[3], param.value[0], param.value[1], drawColor);
    }

    function ripBar(param) {
        console.log("bar", param);
    }

    function ripCircle(param) {
        console.log("circle", param);
    }

    function ripOval(param) {
        console.log("oval", param);
    }

    function ripFilledOval(param) {
        filledOval(param.value[0], param.value[1], param.value[2], param.value[3], drawColor);
    }

    function ripArc(param) {
        console.log("arc", param);
    }

    function ripOvalArc(param) {
        console.log("ovalArc", param);
    }

    function ripPieSlice(param) {
        console.log("pieSlice", param);
    }

    function ripOvalPieSlice(param) {
        console.log("ovalPieSlice", param);
    }

    function ripBezier(param) {
        console.log("bezier", param);
    }

    function ripPolygon(param) {
        polygonOutline(param.value, drawColor);
    }

    function getNodes(values) {
        var nodeX, nodeY, i, j;
        nodeX = new Uint16Array(values[0]);
        nodeY = new Uint16Array(values[0]);
        for (i = 0, j = 1; i < values[0]; ++i) {
            nodeX[i] = values[j++];
            nodeY[i] = values[j++];
        }
        return [nodeX, nodeY];
    }

    function ripFilledPolygon(param) {
        var polys, polyX, polyY, nodeX, pixelY, i, j, polyCorners, nodes, swap;
        polygonOutline(param.value, fillStyle.color);
        polyCorners = param.value[0];
        polys = getNodes(param.value);
        polyX = polys[0];
        polyY = polys[1];
        nodeX = new Uint16Array(param.value[0]);
        for (pixelY = 0; pixelY < 350; ++pixelY) {
            nodes = 0;
            j = polyCorners - 1;
            for (i = 0; i < polyCorners; ++i) {
                if ((polyY[i] < pixelY && polyY[j] >= pixelY) || (polyY[j] < pixelY && polyY[i] >= pixelY)) {
                    nodeX[nodes++] = Math.ceil(polyX[i] + (pixelY - polyY[i]) / (polyY[j] - polyY[i]) * (polyX[j] - polyX[i]));
                }
                j = i;
            }

            i = 0;
            while (i < nodes - 1) {
                if (nodeX[i] > nodeX[i + 1]) {
                    swap = nodeX[i];
                    nodeX[i] = nodeX[i + 1];
                    nodeX[i + 1] = swap;
                    if (i) {
                        --i;
                    }
                } else {
                    i++;
                }
            }

            for (i = 0; i < nodes; i += 2) {
                if (nodeX[i] >= 640) {
                    break;
                }
                if (nodeX[i + 1] > 0) {
                    if (nodeX[i] < 0) {
                        nodeX[i] = 0;
                    }
                    if (nodeX[i + 1] > 639) {
                        nodeX[i + 1] = 639;
                    }
                    for (j = nodeX[i]; j < nodeX[i + 1]; j++) {
                        setPixel(j, pixelY, fillStyle.color);
                    }
                }
            }
        }
    }

    function ripPolyLine(param) {
        console.log("polyLine", param);
    }

    function ripFill(param) {
        console.log("fill", param);
    }

    function ripLineStyle(param) {
        lineStyle.style = param.value[0];
        lineStyle.userPat = param.value[1];
        lineStyle.thick = param.value[2];
    }

    function ripFillStyle(param) {
        useCustomFill = 0;
        fillStyle.pattern = param.value[0];
        fillStyle.color = param.value[1];
    }

    function ripFillPattern(param) {
        var i;
        useCustomFill = 1;
        for (i = 0; i < 8; ++i) {
            customFill.pattern[i] = param.value[i];
        }
        customFill.color = param.value[8];
    }

    function ripMouse(param) {
        console.log("mouse", param);
    }

    function ripKillMouseFields() {
        console.log("killMouseFields");
    }

    function ripBeginText(param) {
        console.log("beginText", param);
    }

    function ripRegionText(param) {
        console.log("regionText", param);
    }

    function ripEndText() {
        console.log("endText");
    }

    function ripGetImage(param) {
        console.log("getImage", param);
    }

    function ripPutImage(param) {
        console.log("putImage", param);
    }

    function ripWriteIcon(param) {
        console.log("writeIcon", param);
    }

    function ripLoadIcon(param) {
        console.log("loadIcon", param);
    }

    function ripButtonStyle(param) {
        console.log("buttonStyle", param);
    }

    function ripButton(param) {
        console.log("button", param);
    }

    function ripDefine(param) {
        console.log("define", param);
    }

    function ripQuery(param) {
        console.log("query", param);
    }

    function ripCopyRegion(param) {
        console.log("copyRegion", param);
    }

    function ripReadScene(param) {
        console.log("readScene", param);
    }

    function ripFileQuery(param) {
        console.log("fileQuery", param);
    }

    function ripEnterBlockMode(param) {
        console.log("enterBlockMode", param);
    }

    function command(cmd) {
        switch (cmd.lvl[0]) {
        case 0:
            switch (cmd.cmd) {
            case "w":
                ripTextWindow(parseParam(cmd.param, [2, 2, 2, 2, 1, 1]));
                break;
            case "v":
                ripViewport(parseParam(cmd.param, [2, 2, 2, 2]));
                break;
            case "*":
                ripResetWindows();
                break;
            case "e":
                ripEraseWindow();
                break;
            case "E":
                ripEraseView();
                break;
            case "g":
                ripGotoXY(parseParam(cmd.param, [2, 2]));
                break;
            case "H":
                ripHome();
                break;
            case ">":
                ripEraseEol();
                break;
            case "c":
                ripColor(parseParam(cmd.param, [2]));
                break;
            case "Q":
                ripSetPalette(parseParam(cmd.param, [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]));
                break;
            case "a":
                ripOnePalette(parseParam(cmd.param, [2, 2]));
                break;
            case "W":
                ripWriteMode(parseParam(cmd.param, [2]));
                break;
            case "m":
                ripMove(parseParam(cmd.param, [2, 2]));
                break;
            case "T":
                ripText(cmd.param);
                break;
            case "@":
                ripTextXY(parseParam(cmd.param, [2, 2]));
                break;
            case "Y":
                ripFontStyle(parseParam(cmd.param, [2, 2, 2, 2]));
                break;
            case "X":
                ripPixel(parseParam(cmd.param, [2, 2]));
                break;
            case "L":
                ripLine(parseParam(cmd.param, [2, 2, 2, 2]));
                break;
            case "R":
                ripRectangle(parseParam(cmd.param, [2, 2, 2, 2]));
                break;
            case "B":
                ripBar(parseParam(cmd.param, [2, 2, 2, 2]));
                break;
            case "C":
                ripCircle(parseParam(cmd.param, [2, 2, 2]));
                break;
            case "O":
                ripOval(parseParam(cmd.param, [2, 2, 2, 2, 2, 2]));
                break;
            case "o":
                ripFilledOval(parseParam(cmd.param, [2, 2, 2, 2]));
                break;
            case "A":
                ripArc(parseParam(cmd.param, [2, 2, 2, 2, 2]));
                break;
            case "V":
                ripOvalArc(parseParam(cmd.param, [2, 2, 2, 2, 2, 2]));
                break;
            case "I":
                ripPieSlice(parseParam(cmd.param, [2, 2, 2, 2, 2]));
                break;
            case "i":
                ripOvalPieSlice(parseParam(cmd.param, [2, 2, 2, 2, 2, 2]));
                break;
            case "Z":
                ripBezier(parseParam(cmd.param, [2, 2, 2, 2, 2, 2, 2, 2, 2]));
                break;
            case "P":
                ripPolygon(parseMultiParam(cmd.param));
                break;
            case "p":
                ripFilledPolygon(parseMultiParam(cmd.param));
                break;
            case "l":
                ripPolyLine(parseMultiParam(cmd.param));
                break;
            case "F":
                ripFill(parseParam(cmd.param, [2, 2, 2]));
                break;
            case "=":
                ripLineStyle(parseParam(cmd.param, [2, 4, 2]));
                break;
            case "S":
                ripFillStyle(parseParam(cmd.param, [2, 2]));
                break;
            case "s":
                ripFillPattern(parseParam(cmd.param, [2, 2, 2, 2, 2, 2, 2, 2, 2]));
                break;
            case "#":
                break;
            default:
                console.log("Unrecognised level-0 command: " + cmd.cmd);
            }
            break;
        case 1:
            switch (cmd.cmd) {
            case "M":
                ripMouse(parseParam(cmd.param, [2, 2, 2, 2, 2, 1, 1, 5]));
                break;
            case "K":
                ripKillMouseFields();
                break;
            case "T":
                ripBeginText(parseParam(cmd.param, [2, 2, 2, 2, 2]));
                break;
            case "t":
                ripRegionText(parseParam(cmd.param, [1]));
                break;
            case "E":
                ripEndText();
                break;
            case "C":
                ripGetImage(parseParam(cmd.param, [2, 2, 2, 2, 1]));
                break;
            case "P":
                ripPutImage(parseParam(cmd.param, [2, 2, 2, 1]));
                break;
            case "W":
                ripWriteIcon(parseParam(cmd.param, [1]));
                break;
            case "I":
                ripLoadIcon(parseParam(cmd.param, [2, 2, 2, 1, 2]));
                break;
            case "B":
                ripButtonStyle(parseParam(cmd.param, [2, 2, 2, 4, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 6]));
                break;
            case "U":
                ripButton(parseParam(cmd.param, [2, 2, 2, 2, 2, 1, 1]));
                break;
            case "D":
                ripDefine(parseParam(cmd.param, [3, 2]));
                break;
            case "\u001b":
                ripQuery(parseParam(cmd.param, [1, 3]));
                break;
            case "G":
                ripCopyRegion(parseParam(cmd.param, [2, 2, 2, 2, 2, 2]));
                break;
            case "R":
                ripReadScene(parseParam(cmd.param, [8]));
                break;
            case "F":
                ripFileQuery(parseParam(cmd.param, [2, 4]));
                break;
            default:
                console.log("Unrecognised level-1 command: " + cmd.cmd);
            }
            break;
        case 9:
            switch (cmd.cmd) {
            case "\u001b":
                ripEnterBlockMode(parseParam(cmd.param, [1, 1, 2, 4]));
                break;
            default:
                console.log("Unrecognised level-9 command: " + cmd.cmd);
            }
            break;
        default:
            console.log("Unrecognised level-" + cmd.lvl + " command: " + cmd.cmd);
        }
    }

    function literal(string) {
        console.log("literal", JSON.stringify(string));
    }

    function render(url, callback) {
        httpGet(url, function (bytes) {
            parseFile(new File(bytes), command, literal, callback);
        });
    }

    return {
        "render": render
    };
}());

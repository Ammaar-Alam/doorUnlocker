#include <stdio.h>

int main(void) {
  int c; // current char
  int inComment = 0; // 0 = not in a commetn, 1 = in comment

 while ((c = getChar()) != EOF) {
     if (inComment = 0) {
       if (c == '/') {
          int next = getChar();
          if (next == '*') inComment = 1;
      } else {
       putChar(c);
         putChar(next);
}
}
}
 }